import { useState, useEffect, useCallback } from 'react';
import './App.css';
import config from './config';

function App() {
  const [gameState, setGameState] = useState('email');
  const [email, setEmail] = useState('');
  const [words, setWords] = useState({ trialWords: [], testWords: [] });
  const [currentWord, setCurrentWord] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [results, setResults] = useState([]);
  const [isTrialMode, setIsTrialMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState(null);

  // Fetch words from backend with retry logic
  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${config.apiUrl}/api/words`);
        if (!response.ok) {
          throw new Error('Failed to fetch words');
        }
        const data = await response.json();
        setWords(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching words:', err);
        setError(err);
        
        // Retry up to 3 times with increasing delays
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, delay);
        } else {
          setIsLoading(false);
        }
      }
    };

    fetchWords();
  }, [retryCount]); // Add retryCount as dependency

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
        fetch(`${config.apiUrl}/api/results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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
    if (isLoading) {
      return (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Kelimeler yükleniyor... <br/> Bir dakika kadar sürebilir.{retryCount > 0 && `(Deneme ${retryCount}/3)`}</p>
          {error && <p className="error-text">Bağlantı hatası. Yeniden deneniyor...</p>}
        </div>
      );
    }

    if (error && retryCount >= 3) {
      return (
        <div className="error-container">
          <h2>Bağlantı Hatası</h2>
          <p>Kelimeler yüklenirken bir hata oluştu. 1 dakika bekleyip sayfayı yenileyiniz.</p>
          <button 
            onClick={() => {
              setRetryCount(0);
              setError(null);
            }}
            className="retry-button"
          >
            Yeniden Dene
          </button>
        </div>
      );
    }
    
    switch (gameState) {
      case 'email':
        return (
          <div className="email-form">
            <form onSubmit={handleEmailSubmit}>
              <h2>Mail Adresinizi Giriniz:</h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Mail Adresinizi Giriniz"
                required
              />
              <button type="submit">Teste başla</button>
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
