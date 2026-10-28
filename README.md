# GeoQuiz 🌍🚩

Mini gioco a livelli in stile Duolingo, con due percorsi distinti: **Geografia** (capitali, continenti) e **Bandiere**.

## Come si gioca
Apri `index.html` nel browser (nessuna installazione). Le immagini delle bandiere vengono da flagcdn.com, quindi serve la connessione.

- 5 unità per percorso, ognuna con 4 lezioni + una sfida finale 🏆: la difficoltà cresce (paesi meno noti, risposte sempre più simili, domande a risposta scritta).
- 5 vite per lezione; le risposte sbagliate tornano a fine lezione.
- XP, stelle e serie di giorni consecutivi, salvati nel browser (localStorage).

## Struttura
- `js/data.js` – paesi con capitale, continente e livello di difficoltà (si aggiungono facilmente nuovi paesi)
- `js/app.js` – generatore di domande, lezioni, progressi
- `css/style.css` – stile
