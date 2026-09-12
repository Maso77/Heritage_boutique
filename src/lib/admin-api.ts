import { supabase } from './supabase';

export interface AdminSession {
  id: string;
  email: string | null;
  full_name: string;
  role: 'admin';
  is_active: boolean;
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: BodyInit | Record<string, unknown> };

function administratorSignInError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  // A 401 from Supabase Auth can be caused by either credentials or the
  // browser's public project key. Keep those two cases distinct: asking an
  // administrator to reset a password cannot fix a malformed VITE key.
  if (message.includes('invalid api key') || message.includes('invalid api_key')) {
    return 'La configuration locale Supabase est invalide. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY, puis redémarrez la prévisualisation.';
  }

  if (message.includes('email not confirmed')) {
    return 'Cette adresse e-mail doit être confirmée dans Supabase avant la connexion.';
  }

  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Trop de tentatives de connexion. Réessayez dans quelques instants.';
  }

  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Supabase est momentanément inaccessible depuis cette prévisualisation. Vérifiez votre connexion réseau et l’URL du projet.';
  }

  return 'Adresse e-mail ou mot de passe incorrect.';
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function adminRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error('Votre session administrateur a expiré.');

  const isJsonBody = options.body && typeof options.body === 'object' && !(options.body instanceof FormData);
  const response = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: isJsonBody ? JSON.stringify(options.body) : (options.body as BodyInit | undefined)
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'La requête administrateur a échoué.');
  return payload as T;
}

export async function downloadAdminCsv(path: string, fileName: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Votre session administrateur a expiré.');
  const response = await fetch(`/api/admin${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'L’export est indisponible.');
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await adminRequest<{ admin: AdminSession }>('/session');
    return response.admin;
  } catch {
    return null;
  }
}

export async function signInAdministrator(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(administratorSignInError(error));

  const admin = await getAdminSession();
  if (!admin) {
    await supabase.auth.signOut();
    throw new Error('Ce compte ne possède pas un accès administrateur actif.');
  }

  return admin;
}

export async function signOutAdministrator() {
  await supabase.auth.signOut();
}

export async function createAdministratorAccount(input: {
  fullName: string;
  email: string;
  password: string;
  invitationCode: string;
}) {
  const response = await fetch('/api/admin/auth/create-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'La création du compte administrateur a échoué.');
  return payload as { success: true };
}
