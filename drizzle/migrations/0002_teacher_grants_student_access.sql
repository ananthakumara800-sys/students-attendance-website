-- Admin or the student's class teacher can set a student's login email.
-- If an account with that email already exists, it gets the student role immediately.
CREATE OR REPLACE FUNCTION public.set_student_email(_student_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := nullif(lower(trim(_email)), '');
DECLARE _uid uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.teaches_student(auth.uid(), _student_id)) THEN
    RAISE EXCEPTION 'Only an admin or this student''s class teacher can do this';
  END IF;
  IF _clean IS NOT NULL AND _clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address';
  END IF;
  UPDATE public.students SET email = _clean WHERE id = _student_id;
  IF _clean IS NOT NULL THEN
    SELECT id INTO _uid FROM auth.users WHERE lower(email) = _clean LIMIT 1;
    IF _uid IS NOT NULL AND NOT public.is_staff(_uid) THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'student') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_student_email(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_student_email(uuid, text) TO authenticated;