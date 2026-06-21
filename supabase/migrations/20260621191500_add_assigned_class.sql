-- Migration: 20260621191500_add_assigned_class.sql
-- Description: Add assigned_class column to teachers to support class teacher functionality

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS assigned_class text;
