function duration_to_mss(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const mmss = `${m}:${s.toString().padStart(2, '0')}`;
        return h > 0 ? `${h}:${mmss}` : mmss;
}

function epoch_to_date(seconds) {
    const date = new Date(seconds * 1000);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

document.addEventListener('DOMContentLoaded', function() {
    if ("Notification" in window) {
        if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("Уведомления разрешены");
                } else {
                    console.log("Уведомления запрещены");
                }
            });
        }
    } else {
        console.log("Браузер не поддерживает уведомления");
    }
});

current_playing = null;
downloading_in_progress = false;
already_downloaded = {};
volume = 75;
channel_name;

async function download(message_id, filename, media) {
    if (already_downloaded[message_id]) {
        const a = document.createElement('a');
        a.href = already_downloaded[message_id];
        a.download = filename;
        a.click();
        return;
    }
    if (downloading_in_progress) {
        toastr.warning('Другой трек уже скачивается!');
        return;
    }
    downloading_in_progress = true;
    song_element = document.getElementById(message_id);
    song_element.getElementsByClassName('downloading')[0].style.display = 'block';
    const response = await fetch(`/api/get_song`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({media: media})
    });
    already_downloaded[message_id] = URL.createObjectURL(await response.blob());
    song_element = document.getElementById(message_id);
    song_element.getElementsByClassName('downloaded')[0].style.display = 'block';
    song_element.getElementsByClassName('downloading')[0].style.display = 'none';
    downloading_in_progress = false;
    download(message_id, filename, '');
}

async function play_song(message_id, media, title, performer) {
    if (downloading_in_progress && current_playing != message_id) {
        toastr.warning('Другой трек уже скачивается!');
        return;
    }
    document.getElementById('player').style.display = 'flex';
    audio = document.getElementById('playsource');
    song_element = document.getElementById(message_id);
    if (current_playing == message_id) {
        if (downloading_in_progress) return;
        song_element.getElementsByClassName('play-button')[0].innerText = audio.paused ? '⏸' : '▶️'
        document.getElementById('play-pause').innerText = song_element.getElementsByClassName('play-button')[0].innerText;
        audio.paused ? audio.play() : audio.pause();
        return;
    }
    try {
        old = document.getElementById(current_playing);
        old.classList.remove('playing');
        old.getElementsByClassName('play-button')[0].innerText = '▶️'
    } catch {}
    current_playing = message_id;
    downloading_in_progress = true;
    song_element.classList.add('playing');
    document.getElementById('track-title').innerText = 'Открытие...';
    document.getElementById('song-cover').src = `https://a-n.vercel.app/${performer}/${title}`;
    song_element.getElementsByClassName('play-button')[0].innerText = '⏸';
    document.getElementById('play-pause').innerText = '⏸';
    document.getElementById('track-artist').innerText = performer;
    document.getElementById('song-list').style.paddingBottom = '70px';
    song_element.getElementsByClassName('downloading')[0].style.display = 'block';
    progressbar = document.getElementById('track-progress');
    audio.addEventListener('timeupdate', () => progressbar.value = (audio.currentTime / audio.duration) * 100);
    progressbar.addEventListener('input', () => audio.currentTime = (progressbar.value * audio.duration) / 100);
    volumecontrol = document.getElementById('volume-control');
    volumecontrol.addEventListener('input', () => audio.volume = volumecontrol.value / 100);
    audio.volume = volume / 100;
    if (already_downloaded[message_id]) audio.src = already_downloaded[message_id];
    else {
        const response = await fetch(`/api/get_song`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({media: media})
        });
        audio.src = URL.createObjectURL(await response.blob());
        already_downloaded[message_id] = audio.src;
        song_element.getElementsByClassName('downloaded')[0].style.display = 'block';
    }
    document.getElementById('track-title').innerText = title;
    document.title = performer + ' - ' + title;
    song_element.getElementsByClassName('downloading')[0].style.display = 'none';
    song_element.getElementsByClassName('play-button')[0].innerText = '⏸';
    document.getElementById('play-pause').innerText = '⏸';
    downloading_in_progress = false;
    audio.play();
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: performer,
            icon: `https://a-n.vercel.app/${performer}/${title}`
        });
    }
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: performer,
            artwork: [{src:`https://a-n.vercel.app/${performer}/${title}`, sizes: '500x500', type: 'image/png'}]
        });
        navigator.mediaSession.setActionHandler('play', playpause);
        navigator.mediaSession.setActionHandler('pause', playpause);
        navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
    audio.onended = () => playNext(true);
}

function playpause() {
    audio = document.getElementById('playsource');
    song_element = document.getElementById(current_playing);
    song_element.getElementsByClassName('play-button')[0].innerText = audio.paused ? '⏸' : '▶️'
    document.getElementById('play-pause').innerText = song_element.getElementsByClassName('play-button')[0].innerText;
    audio.paused ? audio.play() : audio.pause();
}

function playNext(automatic = false) {
    const nextSongElement = document.getElementById(current_playing).nextElementSibling;
    if (nextSongElement && nextSongElement.classList.contains('song-item')) {2
        const media = nextSongElement.querySelector('.cover-wrapper').getAttribute('onclick').match(/play_song\((\d+), '(.+)', '(.+)', '(.+)'\)/);
        play_song(nextSongElement.id, media[2], media[3], media[4]);
    } else {
        toastr.warning('Это последний трек!');
        if (automatic) {
            song_element = document.getElementsByClassName('playing')[0];
            song_element.getElementsByClassName('play-button')[0].innerText = '▶️';
            song_element.classList.remove('playing');
            document.getElementById('player').style.display = 'none';
            document.title = channel_name;
        }
    }
}

function playPrevious() {
    const previousSongElement = document.getElementById(current_playing).previousElementSibling;
    if (previousSongElement && previousSongElement.classList.contains('song-item')) {
        const media = previousSongElement.querySelector('.cover-wrapper').getAttribute('onclick').match(/play_song\((\d+), '(.+)', '(.+)', '(.+)'\)/);
        play_song(previousSongElement.id, media[2], media[3], media[4]);
    } else {
        toastr.warning('Это первый трек!');
    }
}

function logout() {
    $.removeCookie('bot_token');
    document.location = '/auth';
}

const format_size = bytes_size => (Number(bytes_size) / Number(1048576n)).toFixed(2) + " МБ";

const songList = document.getElementById('song-list');
if (!$.cookie('bot_token')) window.location = '/auth';
else {
    const events = new EventSource('/api/get_songs');
    events.onmessage = function(event) {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'flood_wait':
                const waiting = document.createElement('h2');
                waiting.id = 'waiting';
                let seconds = data.value;
                songList.appendChild(waiting);
                timer = setInterval(() => {
                    seconds--;
                    if (seconds >= 0) {
                        waiting.innerHTML = `Ожидание ${seconds} секунд из-за ограничений ТГ`;
                    } else {
                        clearInterval(timer);
                    }
                }, 1000);
                break;
            case 'channel_name':
                channel_name = data.value
                document.getElementById('channel_name').innerText = channel_name;
                document.getElementsByTagName('title')[0].innerText = channel_name;
                try{document.getElementById('waiting').remove();}catch{}
                try{document.getElementById('circle').remove();}catch{}
                break;
            case 'song':
                const audio = JSON.parse(event.data);
                const songelem = document.createElement('div');
                songelem.classList.add('song-item');
                songelem.id = audio['message_id'];
                songelem.innerHTML = `<div class="cover-wrapper" onclick="play_song(${audio['message_id']}, '${audio['media']}', '${audio['title']}', '${audio['performer']}')"><img src="https://a-n.vercel.app/${audio['performer']}/${audio['title']}" alt="Cover" class="cover"><svg xmlns="http://www.w3.org/2000/svg" class="downloading" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width="200" height="200" style="shape-rendering: auto;background: transparent;" xmlns:xlink="http://www.w3.org/1999/xlink"><g><circle stroke-dasharray="207.34511513692632 71.11503837897544" r="44" stroke-width="7" stroke="#ffffff" fill="none" cy="50" cx="50"><animateTransform keyTimes="0;1" values="0 50 50;360 50 50" dur="0.42372881355932207s" repeatCount="indefinite" type="rotate" attributeName="transform"></animateTransform></circle><g></g></g></svg><button class="play-button">▶️</button></div><div class="song-details"><strong class="song-title">${audio['title']}</strong><p class="song-artist">${audio['performer']}</p></div><div class="song-meta"><svg xmlns="http://www.w3.org/2000/svg" width="30px" height="30px" viewBox="0 0 24 24" class="downloaded"><path fill="black" d="m23.5 17l-5 5l-3.5-3.5l1.5-1.5l2 2l3.5-3.5zM6 2c-1.11 0-2 .89-2 2v16c0 1.11.89 2 2 2h7.81c-.53-.91-.81-1.95-.81-3c0-3.31 2.69-6 6-6c.34 0 .67.03 1 .08V8l-6-6m-1 1.5L18.5 9H13Z"/></svg><span class="song-duration">${duration_to_mss(audio['duration'])}</span><span>${format_size(audio['size'])}</span><span class="song-date">${epoch_to_date(audio['date'])}</span><button class="options-button" onclick="download(${audio['message_id']}, '${audio['filename']}', '${audio['media']}')">⬇️</button></div>`
                songList.appendChild(songelem);
        }
    };

    events.onerror = function(event) {
        console.error('Ошибка при получении данных:', event);
    };

    events.onclose = (event) => console.log("done");
}