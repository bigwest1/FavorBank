import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="py-12 flex justify-center">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-h2 mb-2">Sign in</h1>
        <p className="text-muted-foreground mb-6">Use your email and password.</p>
        <AuthForm />
        <div className="mt-4 text-sm text-muted-foreground">
          Don’t have an account? <Link className="underline" href="/signup">Sign up</Link>
        </div>
      </Card>
    </div>
  );
}

