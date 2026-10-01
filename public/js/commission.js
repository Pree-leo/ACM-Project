const artistSelect =
    document.getElementById(
        'artist-select'
    );

const commissionForm =
    document.getElementById(
        'commission-form'
    );

const statusSection =
    document.getElementById(
        'commission-status-section'
    );

const statusContainer =
    document.getElementById(
        'commission-status'
    );

const acceptSection =
    document.getElementById(
        'artist-accept-section'
    );

const acceptButton =
    document.getElementById(
        'accept-commission-button'
    );


let currentRequestId = null;


/*
 * =========================================
 * LOAD ARTISTS
 * =========================================
 */

async function loadArtists() {

    try {

        const response =
            await fetch(
                '/api/artists'
            );


        if (!response.ok) {

            throw new Error(
                'Unable to load artists'
            );

        }


        const artists =
            await response.json();


        artistSelect.innerHTML =
            '<option value="">Select an artist</option>';


        artists.forEach(
            artist => {

                const option =
                    document.createElement(
                        'option'
                    );

                option.value =
                    artist.id;

                option.textContent =
                    `${artist.name} — ${artist.craft}`;

                artistSelect.appendChild(
                    option
                );

            }
        );


    } catch (error) {

        console.error(error);

        artistSelect.innerHTML =
            '<option value="">Unable to load artists</option>';

    }

}


/*
 * =========================================
 * SUBMIT COMMISSION
 * =========================================
 */

commissionForm.addEventListener(
    'submit',
    async function (event) {

        event.preventDefault();


        const artistId =
            artistSelect.value;

        const buyerName =
            document
                .getElementById(
                    'buyer-name'
                )
                .value
                .trim();

        const description =
            document
                .getElementById(
                    'commission-description'
                )
                .value
                .trim();


        if (
            !artistId ||
            !buyerName ||
            !description
        ) {

            return;

        }


        const submitButton =
            commissionForm.querySelector(
                'button[type="submit"]'
            );


        submitButton.disabled =
            true;

        submitButton.textContent =
            'Submitting...';


        try {

            const response =
                await fetch(
                    '/api/commission',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body: JSON.stringify({

                            artistId,

                            buyerName,

                            description

                        })

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    'Commission request failed'
                );

            }


            currentRequestId =
                data.requestId;


            statusSection.classList.remove(
                'hidden'
            );


            acceptSection.classList.remove(
                'hidden'
            );


            displayStatus(
                data
            );


            commissionForm.reset();


            if (
                window.KS &&
                typeof KS.toast ===
                    'function'
            ) {

                KS.toast(
                    'Commission request submitted!'
                );

            }


        } catch (error) {

            console.error(error);

            statusContainer.innerHTML = `

                <p>
                    ${error.message}
                </p>

            `;

        } finally {

            submitButton.disabled =
                false;

            submitButton.textContent =
                'Submit Commission Request';

        }

    }
);


/*
 * =========================================
 * DISPLAY STATUS
 * =========================================
 */

function displayStatus(
    data
) {

    statusContainer.innerHTML = `

        <p>
            <strong>Status:</strong>
            ${data.status}
        </p>

        <p>
            <strong>Request ID:</strong>
            ${data.requestId}
        </p>

        <p>
            Your request has been sent to the artist.
        </p>

    `;

}


/*
 * =========================================
 * ACCEPT COMMISSION
 * =========================================
 */

acceptButton.addEventListener(
    'click',
    async function () {

        if (!currentRequestId) {
            return;
        }


        acceptButton.disabled =
            true;

        acceptButton.textContent =
            'Accepting...';


        try {

            const response =
                await fetch(
                    `/api/commission/${currentRequestId}/accept`,
                    {
                        method: 'POST'
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    'Unable to accept commission'
                );

            }


            displayStatus(
                {
                    status:
                        data.status,

                    requestId:
                        currentRequestId
                }
            );


            acceptButton.textContent =
                'Commission Accepted';


            if (
                window.KS &&
                typeof KS.toast ===
                    'function'
            ) {

                KS.toast(
                    'Commission accepted!'
                );

            }


        } catch (error) {

            console.error(error);

            acceptButton.disabled =
                false;

            acceptButton.textContent =
                'Accept Commission';


            statusContainer.innerHTML += `

                <p>
                    ${error.message}
                </p>

            `;

        }

    }
);


/*
 * =========================================
 * START
 * =========================================
 */

loadArtists();