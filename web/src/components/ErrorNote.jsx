// Shows an ApiError (or any Error) in a red box. Validation errors from
// the services carry an "issues" array - each issue names the field that
// was rejected and why - so we list those too when present.
export default function ErrorNote({ error }) {
  if (!error) return null;

  const issues = Array.isArray(error.issues) ? error.issues : [];

  return (
    <div className="note note-error">
      <p>{error.message}</p>
      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((issue, index) => (
            <li key={`${issue.path}-${index}`}>
              <code>{issue.path}</code> {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
