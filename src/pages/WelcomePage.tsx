import { useStore } from '../store/useStore';
import './WelcomePage.css';

export function WelcomePage() {
  const { createNote } = useStore();
  return (
    <div className="welcome">
      <div className="welcome__inner">
        <p className="welcome__wordmark">nota</p>
        <h1 className="welcome__headline">Your thoughts,<br/>connected.</h1>
        <p className="welcome__sub">Create notes, link ideas with <code>@mentions</code>, and see how everything relates.</p>
        <button className="welcome__cta" onClick={() => createNote()}>
          Create your first note
        </button>
      </div>
    </div>
  );
}
