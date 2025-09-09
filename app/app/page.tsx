import { auth } from "@/auth";

export default async function AppDashboard() {
  const session = await auth();
  return (
    <div className="py-8">
      <h1 className="text-h2">Dashboard</h1>
      <p className="text-muted-foreground mt-2">Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}.</p>
    </div>
  );
}

