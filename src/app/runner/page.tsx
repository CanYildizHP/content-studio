import RunnerClient from './RunnerClient';

export default function RunnerPage() {
  return (
    <>
      <header className="page-head">
        <span className="page-head__kicker">runner</span>
        <h1 className="page-head__title">Skill runs.</h1>
        <p className="page-head__sub">Trigger /research, /can-yildiz-writer, or /research-studio and watch live output.</p>
      </header>
      <RunnerClient />
    </>
  );
}
