(function () {

    const modal =
        document.getElementById(
            'session-modal'
        );

    if (!modal) {
        return;
    }


    const videoButton =
        document.getElementById(
            'session-video-btn'
        );

    const inPersonButton =
        document.getElementById(
            'session-inperson-btn'
        );

    const confirmButton =
        document.getElementById(
            'session-confirm-btn'
        );

    const result =
        document.getElementById(
            'session-result'
        );

    const artistName =
        document.getElementById(
            'session-artist-name'
        );

    let artist = null;
    let selectedMode = null;


    function selectMode(mode) {

        selectedMode = mode;

        videoButton.classList.toggle(
            'selected',
            mode === 'video'
        );

        inPersonButton.classList.toggle(
            'selected',
            mode === 'inperson'
        );

        confirmButton.disabled = false;
    }


    videoButton.onclick = function () {
        selectMode('video');
    };


    inPersonButton.onclick = function () {
        selectMode('inperson');
    };


    window.openSession = function (selectedArtist) {

        artist = selectedArtist;

        selectedMode = null;

        artistName.textContent =
            'Connect with ' +
            artist.name;

        result.textContent = '';

        confirmButton.disabled = true;

        confirmButton.style.display = '';


        videoButton.classList.remove(
            'selected'
        );

        inPersonButton.classList.remove(
            'selected'
        );


        /*
         * The backend uses:
         * video
         * inperson
         */

        videoButton.style.display =
            artist.sessionModes &&
            artist.sessionModes.includes(
                'video'
            )
                ? ''
                : 'none';


        inPersonButton.style.display =
            artist.sessionModes &&
            artist.sessionModes.includes(
                'inperson'
            )
                ? ''
                : 'none';


        modal.classList.remove(
            'hidden'
        );
    };


    confirmButton.onclick =
        async function () {

            if (
                !artist ||
                !selectedMode
            ) {
                return;
            }


            confirmButton.disabled =
                true;


            try {

                const response =
                    await fetch(
                        '/api/session',
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body: JSON.stringify({
                                artistId:
                                    artist.id,

                                mode:
                                    selectedMode
                            })
                        }
                    );


                if (!response.ok) {
                    throw new Error(
                        'Session booking failed'
                    );
                }


                result.textContent =
                    'Session Booked ✅';

                confirmButton.style.display =
                    'none';


                if (
                    window.KS &&
                    typeof KS.toast ===
                        'function'
                ) {
                    KS.toast(
                        'Live session booked successfully!'
                    );
                }

            } catch (error) {

                console.error(
                    error
                );

                result.textContent =
                    'Unable to book session. Please try again.';

                confirmButton.disabled =
                    false;
            }
        };


    document
        .getElementById(
            'session-close'
        )
        .onclick = function () {

            modal.classList.add(
                'hidden'
            );
        };

})();