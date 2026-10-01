window.KS = {
    img: p => '/' + String(p).replace(/^\//, ''),

    coins: {
        get() {
            const v = localStorage.getItem('ks_coins');
            return v === null ? 100 : parseInt(v, 10);
        },

        add(n) {
            localStorage.setItem(
                'ks_coins',
                this.get() + n
            );

            this.render();
        },

        render() {
            const el =
                document.getElementById('coin-balance');

            if (el) {
                el.textContent = this.get();
            }
        }
    },

    toast(msg) {
        const t = document.createElement('div');

        t.className = 'toast';
        t.textContent = msg;

        document.body.appendChild(t);

        setTimeout(() => t.remove(), 2500);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    KS.coins.render();
});