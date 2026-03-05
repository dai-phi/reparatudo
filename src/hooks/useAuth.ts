import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { clearAuth, getMe, getStoredUser, getToken, setStoredUser } from "@/lib/api";

export function useRequireAuth(redirectTo: string) {
  const navigate = useNavigate();
  const token = getToken();
  useEffect(() => {
    if (!token) {
      navigate(redirectTo);
    }
  }, [navigate, redirectTo, token]);
}

export function useAuthUser() {
  const token = getToken();
  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const me = await getMe();
      setStoredUser(me);
      return me;
    },
    enabled: Boolean(token),
    initialData: getStoredUser() ?? undefined,
    retry: false,
  });

  useEffect(() => {
    if (query.error && typeof query.error === "object" && "status" in query.error) {
      if ((query.error as { status: number }).status === 401) {
        clearAuth();
      }
    }
  }, [query.error]);

  return query;
}
