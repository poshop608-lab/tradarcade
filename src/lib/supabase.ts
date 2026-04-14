import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wbbilhyylwkwljntxjux.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYmlsaHl5bHdrd2xqbnR4anV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDA4ODEsImV4cCI6MjA5MTcxNjg4MX0.TV_vEW7EqvLlv2ojmLaTJQjNB-ri3FS9z4gjEDdBT-I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
