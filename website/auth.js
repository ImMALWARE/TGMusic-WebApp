function result(response) {
    
    if (response == 'OK') {
        $.cookie('api_id', api_id);
        $.cookie('api_hash', api_hash);
        $.cookie('bot_token', bot_token);
        $.cookie('channel_id', channel_id);
        window.location = '/';
    } else {
        toastr.error(response.responseText);
    }
}

function login() {
    api_id = $('#api-id').val();
    api_hash = $('#api-hash').val();
    bot_token = $('#tg-bot-token').val();
    channel_id = $('#tg-channel-id').val();
    $.post('/api/check_secrets', {api_id: api_id, api_hash: api_hash, bot_token: bot_token, channel_id: channel_id}).done(result).fail(result)
}