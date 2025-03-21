interface Window {
  ENV?: {
    SUPABASE_URL?: string;
    SUPABASE_KEY?: string;
    [key: string]: string | undefined;
  };
}