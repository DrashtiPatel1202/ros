-- Onboarding fields. Empty means "not done". FSSAI, when set, is a 14-digit licence.
-- Item photos must be an https URL so a bad path cannot be stored as complete.

ALTER TABLE outlets ADD COLUMN IF NOT EXISTS fssai text NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';

DO $$ BEGIN
  ALTER TABLE outlets
    ADD CONSTRAINT outlets_fssai_chk CHECK (fssai = '' OR fssai ~ '^[0-9]{14}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE menu_items
    ADD CONSTRAINT menu_items_description_len CHECK (char_length(description) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE menu_items
    ADD CONSTRAINT menu_items_image_url_chk CHECK (image_url = '' OR image_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
