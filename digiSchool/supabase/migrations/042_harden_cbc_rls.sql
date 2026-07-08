-- 042_harden_cbc_rls.sql

-- 1. Schemes of work
DROP POLICY IF EXISTS "school isolation" ON schemes_of_work;
DROP POLICY IF EXISTS "read all schemes within school" ON schemes_of_work;
DROP POLICY IF EXISTS "insert own schemes" ON schemes_of_work;
DROP POLICY IF EXISTS "update own schemes" ON schemes_of_work;
DROP POLICY IF EXISTS "delete own schemes" ON schemes_of_work;

CREATE POLICY "read all schemes within school" ON schemes_of_work
    FOR SELECT USING (school_id = my_school_id());

CREATE POLICY "insert own schemes" ON schemes_of_work
    FOR INSERT WITH CHECK (school_id = my_school_id() AND teacher_id = auth.uid());

CREATE POLICY "update own schemes" ON schemes_of_work
    FOR UPDATE USING (school_id = my_school_id() AND teacher_id = auth.uid())
    WITH CHECK (school_id = my_school_id() AND teacher_id = auth.uid());

CREATE POLICY "delete own schemes" ON schemes_of_work
    FOR DELETE USING (school_id = my_school_id() AND teacher_id = auth.uid());


-- 2. Lesson plans
DROP POLICY IF EXISTS "school isolation" ON lesson_plans;
DROP POLICY IF EXISTS "read all lesson plans within school" ON lesson_plans;
DROP POLICY IF EXISTS "insert own lesson plans" ON lesson_plans;
DROP POLICY IF EXISTS "update own lesson plans" ON lesson_plans;
DROP POLICY IF EXISTS "delete own lesson plans" ON lesson_plans;

CREATE POLICY "read all lesson plans within school" ON lesson_plans
    FOR SELECT USING (school_id = my_school_id());

CREATE POLICY "insert own lesson plans" ON lesson_plans
    FOR INSERT WITH CHECK (school_id = my_school_id() AND teacher_id = auth.uid());

CREATE POLICY "update own lesson plans" ON lesson_plans
    FOR UPDATE USING (school_id = my_school_id() AND teacher_id = auth.uid())
    WITH CHECK (school_id = my_school_id() AND teacher_id = auth.uid());

CREATE POLICY "delete own lesson plans" ON lesson_plans
    FOR DELETE USING (school_id = my_school_id() AND teacher_id = auth.uid());

NOTIFY pgrst, 'reload schema';
