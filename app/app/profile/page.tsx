import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ProfileSchema = z.object({
  name: z.string().min(1).max(80),
  city: z.string().min(1).max(80).optional().or(z.literal("")),
  avatarSeed: z.string().max(40).optional().or(z.literal("")),
  categories: z.string().optional().or(z.literal("")), // comma-separated for simple UI
});

async function updateProfile(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const parsed = ProfileSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    avatarSeed: formData.get("avatarSeed"),
    categories: formData.get("categories"),
  });
  if (!parsed.success) return;
  const { name, city, avatarSeed, categories } = parsed.data;
  const catArray = (categories ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      name,
      city: city || null,
      avatarSeed: avatarSeed || null,
      categories: catArray.length ? (catArray as any) : null,
    },
  });
  revalidatePath("/app/profile");
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) notFound();
  const cats = Array.isArray(user.categories) ? (user.categories as string[]) : [];
  return (
    <div className="py-8 max-w-2xl">
      <h1 className="text-h2 mb-4">Your Profile</h1>
      <Card className="p-6">
        <form action={updateProfile} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input name="name" defaultValue={user.name ?? ""} required />
          </div>
          <div>
            <label className="text-sm font-medium">City</label>
            <Input name="city" defaultValue={user.city ?? ""} />
          </div>
          <div>
            <label className="text-sm font-medium">Avatar Seed</label>
            <Input name="avatarSeed" defaultValue={user.avatarSeed ?? ""} />
          </div>
          <div>
            <label className="text-sm font-medium">What I like helping with</label>
            <Input
              name="categories"
              placeholder="e.g., tutoring, errands, pet care"
              defaultValue={cats.join(", ")}
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated categories</p>
          </div>
          <Button type="submit" variant="brand">Save</Button>
        </form>
      </Card>
    </div>
  );
}

