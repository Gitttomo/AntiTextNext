import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type BookLookupResult = {
  title: string;
  originalPrice?: number | null;
  source: "openbd" | "google_books";
  cached?: boolean;
};

const normalizeIsbn = (value: string | null) => (value || "").replace(/\D/g, "");

const parsePrice = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

async function getCachedBook(isbn: string): Promise<BookLookupResult | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await (supabase.from("book_isbn_cache") as any)
    .select("title, original_price, source")
    .eq("isbn", isbn)
    .maybeSingle();

  if (error) {
    console.error("Book cache read error:", error);
    return null;
  }

  if (!data?.title) return null;

  return {
    title: data.title,
    originalPrice: data.original_price ?? null,
    source: data.source,
    cached: true,
  };
}

async function saveCachedBook(isbn: string, book: BookLookupResult) {
  const supabase = getSupabase();
  if (!supabase) return;

  const now = new Date().toISOString();
  const { error } = await (supabase.from("book_isbn_cache") as any).upsert(
    {
      isbn,
      title: book.title,
      original_price: book.originalPrice ? Math.round(book.originalPrice) : null,
      source: book.source,
      updated_at: now,
      last_checked_at: now,
    },
    { onConflict: "isbn" }
  );

  if (error) {
    console.error("Book cache write error:", error);
  }
}

async function lookupOpenBd(isbn: string): Promise<BookLookupResult | null> {
  const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const book = Array.isArray(data) ? data[0] : null;
  if (!book?.summary?.title) return null;

  const onix = book.onix;
  const price = parsePrice(
    onix?.ProductSupply?.SupplyDetail?.Price?.[0]?.PriceAmount ??
      onix?.ProductSupply?.SupplyDetail?.Price?.PriceAmount
  );

  return {
    title: book.summary.title,
    originalPrice: price,
    source: "openbd",
  };
}

async function lookupGoogleBooks(isbn: string): Promise<BookLookupResult | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn}`);
  if (apiKey) url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  const data = await response.json();

  if (!response.ok) {
    console.error("Google Books API error:", data);
    return null;
  }

  if (!data?.totalItems || !data.items?.[0]?.volumeInfo?.title) return null;

  return {
    title: data.items[0].volumeInfo.title,
    originalPrice: parsePrice(data.items[0].saleInfo?.listPrice?.amount),
    source: "google_books",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = normalizeIsbn(searchParams.get("isbn"));

  if (!/^97[89]\d{10}$/.test(isbn)) {
    return NextResponse.json({ error: "invalid_isbn" }, { status: 400 });
  }

  try {
    const cachedBook = await getCachedBook(isbn);
    if (cachedBook) {
      return NextResponse.json(cachedBook);
    }

    const openBdResult = await lookupOpenBd(isbn);
    if (openBdResult) {
      await saveCachedBook(isbn, openBdResult);
      return NextResponse.json(openBdResult);
    }

    const googleResult = await lookupGoogleBooks(isbn);
    if (googleResult) {
      await saveCachedBook(isbn, googleResult);
      return NextResponse.json(googleResult);
    }

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    console.error("Book lookup error:", error);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
}
