import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { clearAuth, getMe, getStoredUser, setStoredUser } from "@/lib/api";

export function useRequireAuth(redirectTo: string) {
  const navigate = useNavigate();
  const { data: user, isLoading } = useAuthUser();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, navigate, redirectTo]);
}

export function useAuthUser() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const me = await getMe();
      setStoredUser(me);
      return me;
    },
    enabled: true,
    initialData: getStoredUser() ?? undefined,
    retry: false,
    staleTime: 60 * 1000,
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
