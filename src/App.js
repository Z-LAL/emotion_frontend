import { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [gameState, setGameState] = useState('email');
  const [email, setEmail] = useState('');
  const [words, setWords] = useState({ trialWords: [], testWords: [] });
  const [currentWord, setCurrentWord] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [results, setResults] = useState([]);
  const [isTrialMode, setIsTrialMode] = useState(true);

  // Fetch words from backend
  useEffect(() => {
    fetch('http://localhost:5000/api/words')
      .then(res => res.json())
      .then(data => setWords(data))
      .catch(err => console.error('Error fetching words:', err));
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (event) => {
      switch (gameState) {
        case 'start':
          if (event.code === 'Space') setGameState('explain');
          break;
        case 'explain':
          if (event.code === 'Space') {
            setGameState('trial');
            setCurrentWord(words.trialWords[0]);
            setStartTime(performance.now());
          }
          break;
        case 'trial':
          if (!currentWord && event.code === 'Space') {
            // Move to main test only after trial completion message is shown
            setGameState('playing');
            setCurrentWord(words.testWords[0]);
            setStartTime(performance.now());
          } else if (currentWord && (event.code === 'ArrowRight' || event.code === 'ArrowLeft')) {
            const response = event.code === 'ArrowRight' ? 'positive' : 'negative';
            handleResponse(response);
          }
          break;
        case 'playing':
          if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
            const response = event.code === 'ArrowRight' ? 'positive' : 'negative';
            handleResponse(response);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState, words, currentWord]);

  const handleResponse = useCallback((response) => {
    if (!currentWord || !startTime) return;

    const responseTime = Math.round(performance.now() - startTime);
    const result = {
      word: currentWord.word,
      emotion: currentWord.emotion,
      language: currentWord.language,
      response,
      responseTime
    };

    setResults(prev => [...prev, result]);

    if (isTrialMode) {
      const nextTrialIndex = words.trialWords.indexOf(currentWord) + 1;
      if (nextTrialIndex < words.trialWords.length) {
        setCurrentWord(words.trialWords[nextTrialIndex]);
      } else {
        setIsTrialMode(false);
        setCurrentWord(null); // Set to null to show trial completion message
      }
    } else {
      const nextIndex = words.testWords.indexOf(currentWord) + 1;
      if (nextIndex < words.testWords.length) {
        setCurrentWord(words.testWords[nextIndex]);
      } else {
        // Save results first, then update game state
        fetch('http://localhost:5000/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            results
          })
        })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              console.error('Error saving results:', err);
              alert('Error saving results. Please try again.');
              throw new Error(err.error || 'Failed to save results');
            });
          }
          return response.json();
        })
        .then(data => {
          console.log('Results saved successfully:', data);
          setGameState('completed');
        })
        .catch(error => {
          console.error('Error:', error);
          alert('Error saving results: ' + error.message);
        });
      }
    }

    setStartTime(performance.now());
  }, [currentWord, startTime, isTrialMode, words, results]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (trimmedEmail && trimmedEmail.includes('@')) {
      setEmail(trimmedEmail); // Save the trimmed email
      setGameState('start');
    } else {
      alert('Please enter a valid email address');
    }
  };

  const renderContent = () => {
    switch (gameState) {
      case 'email':
        return (
          <div className="email-form">
            <form onSubmit={handleEmailSubmit}>
              <h2>Please enter your email address</h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
              <button type="submit">Start Test</button>
            </form>
          </div>
        );
      case 'start':
        return <div className="instruction"><font size="8"><b>Kelime Sınıflandırma</b><br/><br/>Başlamak için”<u>Space/Boşluk</u>” tuşuna basınız.</font></div>;
      case 'explain':
        return <div className="instruction"><font size="7">Değerli Katılımcı,<br/><br/>
Bu çalışma kelimeleri sınıflandırma sürenizi ölçmeyi amaçlamaktadır.<br/><br/>
Deney sırasında ekranda kelimeler göreceksiniz.<br/>
Göreviniz, kelimenin anlamına göre hızlı bir şekilde yanıt vermektir.<br/><br/>
Karşınıza çıkan kelime <b><u>pozitif</u></b> bir duygu içeriyor ise klavyede<br/>
<u>Sağ ok tuşu(-{'>'})</u> <b><u>negatif</u></b> bir duygu içeriyor ise <u>Sol ok tuşuna ({'<'}-)</u> olabildiğince<br/>
hızlı bir şekilde basmanız ve bir sonraki kelimeye geçmenizdir.<br/><br/>
Hazır olduğunuzda, <u>'Space/Boşluk'</u> tuşuna basarak deneye başlayabilirsiniz.</font></div>;        case 'trial':
        case 'playing':
          if (gameState === 'trial' && !currentWord && !isTrialMode) {
            return (
              <div className="instruction">
                <font size= "7"><b>
                Deneme testi tamamlanmıştır.<br/><br/>
                Asıl teste başlamak için <u>"Space/Boşluk"</u> tuşuna basınız.</b>
                </font>
              </div>
            );
          }
          if (currentWord) {
            return (
              <div className="word">
                <div className="phase-indicator">
                </div>
                <div className="word-text">{currentWord.word}</div>
                <div className="controls">
                </div>
              </div>
            );
          }
          return null;
      case 'completed':
        return <div className="instruction"><font size="7">Test tamamlandı!<br/>
Katılımınız için teşekkürler.</font></div>;
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <div className="experiment-container">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
