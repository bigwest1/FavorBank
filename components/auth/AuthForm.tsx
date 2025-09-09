"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof LoginSchema>;

export function AuthForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/app";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = async (data: FormData) => {
    await signIn("credentials", { ...data, redirect: true, callbackUrl });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <Input type="email" placeholder="you@example.com" {...register("email")} />
        {errors.email && (
          <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
        )}
      </div>
      <div>
        <Input type="password" placeholder="Password" {...register("password")} />
        {errors.password && (
          <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full" variant="brand">
        Sign In
      </Button>
    </form>
  );
}

export default AuthForm;

