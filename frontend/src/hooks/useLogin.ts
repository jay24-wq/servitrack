import { useMutation } from '@tanstack/react-query';
import { loginRequest, type LoginResult } from '../lib/api';

export function useLogin() {
  return useMutation<LoginResult, any, { email: string; password: string; slug: string }>({
    mutationFn: ({ email, password, slug }) => loginRequest(email, password, slug),
  });
}
