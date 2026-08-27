import { NewSeasonForm } from "@/components/new/NewSeasonForm";

export default function NewSeasonPage() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-display text-4xl tracking-wide text-chalk">New Season</h1>
      <p className="text-sm text-chalk-muted">
        You&apos;ll get two links: one to share with your league, and a private admin link — bookmark
        that one, don&apos;t share it.
      </p>
      <NewSeasonForm />
    </div>
  );
}
