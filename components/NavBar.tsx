"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";

export function NavBar() {
  const { user, loading } = useUser();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 pt-6">
      <Link href="/search" className="text-xl font-bold">
        PokePoke
      </Link>
      <Link href="/search" className="text-sm hover:underline">
        Find cards
      </Link>
      <Link href="/collection" className="text-sm hover:underline">
        My collection
      </Link>

      <div className="ml-auto text-sm">
        {loading ? null : user ? (
          <>
            <span className="mr-3 text-gray-400">{user.email}</span>
            <button onClick={signOut} className="underline">
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="underline">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
