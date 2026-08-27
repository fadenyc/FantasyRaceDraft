interface RaceResultsTableProps {
  finalOrder: string[];
  teamNameById: Record<string, string>;
}

export function RaceResultsTable({ finalOrder, teamNameById }: RaceResultsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-turf-700">
      <table className="w-full text-sm">
        <thead className="bg-turf-800">
          <tr>
            <th className="px-4 py-2 text-left font-display text-base font-normal tracking-wide text-chalk-muted">
              Pick
            </th>
            <th className="px-4 py-2 text-left font-display text-base font-normal tracking-wide text-chalk-muted">
              Team
            </th>
          </tr>
        </thead>
        <tbody>
          {finalOrder.map((teamId, index) => (
            <tr key={teamId} className="border-t border-turf-700">
              <td className="px-4 py-2 font-bold tabular-nums text-gold-500">{index + 1}</td>
              <td className="px-4 py-2 text-chalk">{teamNameById[teamId] ?? "Unknown team"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
