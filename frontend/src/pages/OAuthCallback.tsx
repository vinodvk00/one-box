import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      const error = searchParams.get("error");
      const message = searchParams.get("message");
      const success = searchParams.get("success");

      if (error) {
        navigate(`/login?oauth=error&message=${encodeURIComponent(message || error || "OAuth authentication failed")}`, {
          replace: true,
        });
        return;
      }

      if (success === "true") {
        await checkAuth();
        navigate("/", { replace: true });
      } else {
        await checkAuth();
        navigate("/", { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, navigate, checkAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Completing authentication...
        </p>
      </div>
    </div>
  );
}
