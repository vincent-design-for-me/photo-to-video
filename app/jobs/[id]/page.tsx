import JobClient from "./JobClient";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobClient id={id} />;
}
