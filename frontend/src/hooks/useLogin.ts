import { useMutation } from '@tanstack/react-query';
import { loginRequest, type LoginPortal, type LoginResult } from '../lib/api';

export function useLogin() {
  return useMutation<LoginResult, any, { email: string; password: string; portal: LoginPortal }>({
    mutationFn: ({ email, password, portal }) => loginRequest(email, password, portal),
  });
}
