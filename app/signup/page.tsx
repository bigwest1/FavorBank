import { Card } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/SignupForm";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="py-12 flex justify-center">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-h2 mb-2">Create account</h1>
        <p className="text-muted-foreground mb-6">Start trading favors securely.</p>
        <SignupForm />
        <div className="mt-4 text-sm text-muted-foreground">
          Already have an account? <Link className="underline" href="/login">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}

