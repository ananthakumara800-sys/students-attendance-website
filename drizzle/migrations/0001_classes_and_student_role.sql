ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS students_email_key ON public.students (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department text NOT NULL,
  year int NOT NULL,
  section text NOT NULL,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_students (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_students TO authenticated;
GRANT ALL ON public.class_students TO service_role;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.teaches_student(_user_id uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_students cs JOIN public.classes c ON c.id = cs.class_id
                 WHERE c.teacher_id = _user_id AND cs.student_id = _student_id)
$$;

CREATE OR REPLACE FUNCTION public.is_own_student(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.students WHERE id = _student_id AND email IS NOT NULL
                 AND lower(email) = lower(auth.jwt()->>'email'))
$$;

-- classes
CREATE POLICY "staff read classes" ON public.classes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff read rosters" ON public.class_students FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write rosters" ON public.class_students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- students: staff read, admin write, student reads own
DROP POLICY "staff manage students" ON public.students;
CREATE POLICY "staff read students" ON public.students FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "student reads self" ON public.students FOR SELECT TO authenticated
  USING (email IS NOT NULL AND lower(email) = lower(auth.jwt()->>'email'));
CREATE POLICY "admin write students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- attendance: staff read, admin or class teacher write, student reads own
DROP POLICY "staff manage attendance" ON public.attendance;
CREATE POLICY "staff read attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "student reads own attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_own_student(student_id));
CREATE POLICY "teacher or admin write attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.teaches_student(auth.uid(), student_id))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.teaches_student(auth.uid(), student_id));

-- admins manage roles; teachers can see profile names of staff (for class teacher display)
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, DELETE ON public.user_roles TO authenticated;
CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- New signups: first user admin; email matching a student -> student; others wait for admin to assign a role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), NEW.email)
  ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSIF EXISTS (SELECT 1 FROM public.students WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;
  RETURN NEW;
END $$;

-- Sample classes from demo students
INSERT INTO public.classes (name, department, year, section)
SELECT DISTINCT department || ' ' || year || '-' || section || ' (Sample)', department, year, section FROM public.students WHERE is_sample;
INSERT INTO public.class_students (class_id, student_id)
SELECT c.id, s.id FROM public.classes c JOIN public.students s
  ON s.department = c.department AND s.year = c.year AND s.section = c.section AND s.is_sample;