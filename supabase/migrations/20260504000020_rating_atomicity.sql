CREATE OR REPLACE FUNCTION public.submit_transaction_rating(
  target_transaction_id UUID,
  score_value INTEGER,
  comment_text TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx_record RECORD;
  rated_user_id UUID;
  other_rating_exists BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF score_value < 1 OR score_value > 5 THEN
    RAISE EXCEPTION 'rating score must be between 1 and 5';
  END IF;

  SELECT *
  INTO tx_record
  FROM public.transactions
  WHERE id = target_transaction_id
  FOR UPDATE;

  IF tx_record.id IS NULL THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  IF tx_record.status <> 'awaiting_rating' THEN
    RAISE EXCEPTION 'transaction is not awaiting rating';
  END IF;

  IF auth.uid() = tx_record.buyer_id THEN
    rated_user_id := tx_record.seller_id;
  ELSIF auth.uid() = tx_record.seller_id THEN
    rated_user_id := tx_record.buyer_id;
  ELSE
    RAISE EXCEPTION 'only transaction participants can rate';
  END IF;

  INSERT INTO public.ratings(transaction_id, rater_id, rated_id, score, comment)
  VALUES (target_transaction_id, auth.uid(), rated_user_id, score_value, comment_text);

  SELECT EXISTS (
    SELECT 1
    FROM public.ratings
    WHERE transaction_id = target_transaction_id
      AND rater_id = rated_user_id
  )
  INTO other_rating_exists;

  IF other_rating_exists THEN
    UPDATE public.transactions
    SET status = 'completed'
    WHERE id = target_transaction_id;

    UPDATE public.items
    SET status = 'sold'
    WHERE id = tx_record.item_id;

    INSERT INTO public.messages(item_id, sender_id, receiver_id, message, is_read)
    VALUES (
      tx_record.item_id,
      auth.uid(),
      rated_user_id,
      '【評価が送信されました】' || E'\n\n' || '双方の評価が完了したため、取引が正式に完了しました。ご利用ありがとうございました!',
      false
    );

    INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
    VALUES
      (
        rated_user_id,
        'transaction_completed',
        '取引が完了しました',
        '双方の評価が完了したため、取引が正式に完了しました。',
        'chat',
        tx_record.item_id,
        false
      ),
      (
        auth.uid(),
        'transaction_completed',
        '取引が完了しました',
        '双方の評価が完了したため、取引が正式に完了しました。',
        'chat',
        tx_record.item_id,
        false
      );

    RETURN TRUE;
  END IF;

  INSERT INTO public.messages(item_id, sender_id, receiver_id, message, is_read)
  VALUES (
    tx_record.item_id,
    auth.uid(),
    rated_user_id,
    '【評価が送信されました】' || E'\n\n' || '取引完了ボタンより、取引完了及び評価を行ってください。',
    false
  );

  INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
  VALUES (
    rated_user_id,
    'rating_received',
    '評価をしてください',
    '取引相手から評価が送信されました。取引完了ボタンより、取引完了及び評価を行ってください。',
    'chat',
    tx_record.item_id,
    false
  );

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_transaction_rating(UUID, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
