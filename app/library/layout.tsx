import Navbar from "@/app/components/Navbar";

// The library is public and static: the navbar resolves the signed-in user on
// the client so this route never has to wait on a server-side session read.
export default function LibraryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
