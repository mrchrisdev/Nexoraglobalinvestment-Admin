const usersStorageKey = 'investUsers';
const requestsStorageKey = 'investRequests';
const supportStorageKey = 'investSupportConversations';
const depositAddressesStorageKey = 'investDepositAddresses';
const cardFee = 5;

const defaultDepositAddresses = {
    btc: 'bc1q7x9m2demo8k3w4n6p0q',
    eth: '0x7F3b9B287b6A6c4d1A4f872A7FA72ed3c6dD49e5',
    ltc: 'LQ5sE8YkK9imw9T4b7D8mN3Qg8W9n8UdD7',
    doge: 'D9mXh3X5fH4x5pVvFBz7q8Nd2F8QHbNnWQ',
    usdt: 'TQfRzZg5xvaG8V4mTqB2n7V8fR8pVx4fSj',
    usdc: '0x4E7dE3A72dA4B651480a36D5F5d11D5a9C4A7c30'
};

function addTransaction(user, transaction) {
    user.transactions ||= [];
    user.transactions.push({
        id: transaction.id || `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        status: 'Completed',
        ...transaction
    });
}

const usersTableBody = document.getElementById('usersTableBody');
const userCount = document.getElementById('userCount');
const adminStatus = document.getElementById('adminStatus');
const requestsTableBody = document.getElementById('requestsTableBody');
const supportTableBody = document.getElementById('supportTableBody');
const cryptoAssets = [
    { key: 'btc', label: 'BTC' },
    { key: 'eth', label: 'ETH' },
    { key: 'ltc', label: 'LTC' },
    { key: 'doge', label: 'DOGE' },
    { key: 'usdt', label: 'USDT' },
    { key: 'usdc', label: 'USDC' }
];

function readStorage(key, fallback = []) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
        if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;
        if (fallback && typeof fallback === 'object' && value && typeof value === 'object') return value;
        return Array.isArray(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

function getDepositAddresses() {
    return { ...defaultDepositAddresses, ...readStorage(depositAddressesStorageKey, {}) };
}

function deleteUserAccount(email) {
    const users = readStorage(usersStorageKey, []);
    const remainingUsers = users.filter((user) => user.email !== email);
    if (remainingUsers.length === users.length) {
        adminStatus.textContent = 'No account found for this email.';
        return;
    }

    localStorage.setItem(usersStorageKey, JSON.stringify(remainingUsers));

    const currentUser = JSON.parse(localStorage.getItem('investCurrentUser') || 'null');
    if (currentUser && currentUser.email === email) {
        localStorage.removeItem('investCurrentUser');
    }

    const requests = readStorage(requestsStorageKey, []).filter((request) => request.userEmail !== email);
    localStorage.setItem(requestsStorageKey, JSON.stringify(requests));

    adminStatus.textContent = `Account ${email} was deleted successfully.`;
    renderUsers();
    renderRequests();
    renderSupportBoard();
}

function renderUsers() {
    if (!usersTableBody) return;
    const users = readStorage(usersStorageKey, []);
    userCount.textContent = users.length;
    usersTableBody.replaceChildren();

    if (!users.length) {
        adminStatus.textContent = 'No accounts have been registered yet.';
        return;
    }

    adminStatus.textContent = 'Account details are stored in this browser for the prototype.';
    users.forEach((user) => {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        const emailCell = document.createElement('td');
        const passwordCell = document.createElement('td');
        const dateCell = document.createElement('td');
        const actionCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        nameCell.textContent = user.name;
        emailCell.textContent = user.email;
        passwordCell.textContent = user.password || 'Not available';
        dateCell.textContent = new Date(user.createdAt).toLocaleString();
        deleteButton.type = 'button';
        deleteButton.className = 'reject';
        deleteButton.dataset.userEmail = user.email;
        deleteButton.textContent = 'Delete';
        actionCell.appendChild(deleteButton);
        row.append(nameCell, emailCell, passwordCell);
        cryptoAssets.forEach(({ key, label }) => {
            const balanceCell = document.createElement('td');
            balanceCell.className = 'balance-cell';
            const assetValue = user.cryptoBalances?.[key] ?? 0;
            balanceCell.innerHTML = `<strong>${formatCryptoAmount(assetValue)} ${label}</strong><form class="balance-form" data-user-email="${encodeURIComponent(user.email)}" data-asset="${key}"><input type="number" name="amount" min="0.00000001" step="any" placeholder="Amount" required aria-label="${label} amount for ${user.email}"><button type="submit" name="action" value="increase" class="increase">Increase</button><button type="submit" name="action" value="reduce" class="reduce">Reduce</button></form>`;
            row.appendChild(balanceCell);
        });
        row.appendChild(dateCell);
        row.appendChild(actionCell);
        usersTableBody.appendChild(row);
    });
}

function formatCryptoAmount(value) {
    return (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function updateCryptoBalance(email, asset, action, amount) {
    const users = readStorage(usersStorageKey, []);
    const user = users.find((item) => item.email === email);
    if (!user) return;

    user.cryptoBalances = user.cryptoBalances && typeof user.cryptoBalances === 'object'
        ? user.cryptoBalances
        : {};
    const currentBalance = Number(user.cryptoBalances[asset]) || 0;
    user.cryptoBalances[asset] = Math.max(0, action === 'increase' ? currentBalance + amount : currentBalance - amount);
    addTransaction(user, {
        type: action === 'increase' ? 'deposit' : 'balance_adjustment',
        direction: action === 'increase' ? 'in' : 'out',
        asset: asset.toUpperCase(),
        amount,
        description: action === 'increase' ? 'Deposit' : 'Admin wallet debit',
        note: 'Completed',
        status: 'Completed'
    });
    localStorage.setItem(usersStorageKey, JSON.stringify(users));
    adminStatus.textContent = `${user.name}'s ${asset.toUpperCase()} balance is now ${formatCryptoAmount(user.cryptoBalances[asset])}.`;
    renderUsers();
}

function renderRequests() {
    if (!requestsTableBody) return;
    const requests = readStorage(requestsStorageKey, []);
    requestsTableBody.replaceChildren();
    const pendingRequests = requests.filter((request) => request.status === 'pending');
    if (!pendingRequests.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4">No pending requests.</td>';
        requestsTableBody.appendChild(row);
        return;
    }
    pendingRequests.forEach((request) => {
        const row = document.createElement('tr');
        const details = request.type === 'transaction'
            ? `${request.details.coin}, ${request.details.amount} to ${request.details.recipient}`
            : request.type === 'deposit'
                ? `${request.details.coin.toUpperCase()}, ${request.details.amount}`
                : request.details.type || request.details.name || request.details.asset;
        row.innerHTML = `<td>${request.userName || request.userEmail}<br>${request.userEmail || 'Unknown user'}</td><td>${request.type}</td><td>${details}</td><td class="request-actions"><button class="approve" data-request-action="approve" data-request-id="${request.id}">Approve</button><button class="reject" data-request-action="reject" data-request-id="${request.id}">Reject</button></td>`;
        requestsTableBody.appendChild(row);
    });
}

function updateRequest(requestId, nextStatus) {
    const requests = readStorage(requestsStorageKey, []);
    const request = requests.find((item) => item.id === requestId);
    if (!request || request.status !== 'pending') return;
    request.status = nextStatus;
    const users = readStorage(usersStorageKey, []);
    const user = users.find((item) => item.email === request.userEmail);
    if (user) {
        user.requests ||= [];
        const userRequest = user.requests.find((item) => item.id === requestId);
        if (userRequest) userRequest.status = nextStatus;
        if (nextStatus === 'approved') {
            if (request.type === 'card') {
                user.balance = (Number(user.balance) || 0) - cardFee;
                user.cards = [...(user.cards || []), { type: request.details.type, asset: request.details.asset, balance: 0, fee: cardFee, createdAt: new Date().toISOString() }];
                addTransaction(user, { type: 'card_fee', direction: 'out', asset: 'USD', amount: cardFee, description: 'Card activation fee', note: `${request.details.type} fee` });
            }
            if (request.type === 'deposit') {
                user.cryptoBalances ||= {};
                user.cryptoBalances[request.details.coin.toLowerCase()] = (Number(user.cryptoBalances[request.details.coin.toLowerCase()]) || 0) + Number(request.details.amount);
                addTransaction(user, { id: request.id, type: 'deposit', direction: 'in', asset: request.details.coin.toUpperCase(), amount: Number(request.details.amount), description: 'Wallet deposit', note: 'Admin-approved deposit' });
            }
            if (request.type === 'investment') user.investments = [...(user.investments || []), { name: request.details.name, amount: request.details.amount, createdAt: new Date().toISOString() }];
            if (request.type === 'transaction') {
                const assetKey = request.details.coin.toLowerCase();
                const currentBalance = Number(user.cryptoBalances?.[assetKey]) || 0;
                const nextBalance = currentBalance - Number(request.details.amount);
                user.cryptoBalances ||= {};
                user.cryptoBalances[assetKey] = Math.max(0, nextBalance);
                addTransaction(user, { id: request.id, type: 'transfer', direction: 'out', asset: request.details.coin, amount: Number(request.details.amount), recipient: request.details.recipient, description: 'Crypto transfer', note: request.details.note || 'Sent crypto' });
            }
        }
        localStorage.setItem(usersStorageKey, JSON.stringify(users));
    }
    localStorage.setItem(requestsStorageKey, JSON.stringify(requests));
    renderRequests();
    renderUsers();
    renderSupportBoard();
}

function renderDepositAddressControls() {
    const panel = document.getElementById('depositAddressPanel');
    if (!panel) return;
    const addresses = getDepositAddresses();
    const options = Object.entries(defaultDepositAddresses).map(([key, value]) => `<option value="${key}">${key.toUpperCase()} (${value.slice(0, 12)}...)</option>`).join('');
    panel.innerHTML = `
        <h2 class="admin-section-title">Deposit address override</h2>
        <form id="depositAddressForm" class="address-form">
            <select id="depositAddressAsset" aria-label="Asset">
                ${options}
            </select>
            <input id="depositAddressValue" type="text" value="${addresses.btc}" placeholder="Deposit address" aria-label="Address value" required>
            <button type="submit" class="approve">Save address</button>
        </form>
    `;

    const assetSelect = document.getElementById('depositAddressAsset');
    const addressInput = document.getElementById('depositAddressValue');
    assetSelect.addEventListener('change', () => {
        addressInput.value = addresses[assetSelect.value] || defaultDepositAddresses[assetSelect.value] || '';
    });

    document.getElementById('depositAddressForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const assetKey = assetSelect.value;
        const value = addressInput.value.trim();
        if (!value) {
            adminStatus.textContent = 'A deposit address is required.';
            return;
        }
        const preserved = getDepositAddresses();
        preserved[assetKey] = value;
        localStorage.setItem(depositAddressesStorageKey, JSON.stringify(preserved));
        adminStatus.textContent = `${assetKey.toUpperCase()} deposit address updated.`;
    });
}

function renderSupportBoard() {
    if (!supportTableBody) return;
    const conversations = readStorage(supportStorageKey, {});
    const entries = Object.entries(conversations || {}).filter(([, messages]) => Array.isArray(messages) && messages.length);
    supportTableBody.replaceChildren();

    if (!entries.length) {
        supportTableBody.innerHTML = '<tr><td colspan="3">No support messages yet.</td></tr>';
        return;
    }

    entries.forEach(([email, messages]) => {
        const latest = [...messages].filter((message) => message?.text).slice(-1)[0];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${email}<br><small>Latest: ${new Date(latest?.createdAt || Date.now()).toLocaleString()}</small></td>
            <td>${latest ? latest.text : 'No message'}</td>
            <td>
                <form class="support-reply-form" data-user-email="${encodeURIComponent(email)}">
                    <textarea name="reply" rows="2" placeholder="Reply to customer" required></textarea>
                    <button type="submit" class="approve">Send reply</button>
                </form>
            </td>
        `;
        supportTableBody.appendChild(row);
    });
}

function sendSupportReply(email, text) {
    const conversations = readStorage(supportStorageKey, {});
    const userEmail = decodeURIComponent(email);
    const messages = Array.isArray(conversations[userEmail]) ? conversations[userEmail] : [];
    messages.push({ sender: 'support', text, createdAt: new Date().toISOString() });
    conversations[userEmail] = messages;
    localStorage.setItem(supportStorageKey, JSON.stringify(conversations));
    adminStatus.textContent = `Reply sent to ${userEmail}.`;
    renderSupportBoard();
}

requestsTableBody.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-request-action]');
    if (actionButton) updateRequest(actionButton.dataset.requestId, actionButton.dataset.requestAction === 'approve' ? 'approved' : 'rejected');
});

usersTableBody.addEventListener('submit', (event) => {
    const form = event.target.closest('.balance-form');
    if (!form) return;
    event.preventDefault();
    const amount = Number(new FormData(form).get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateCryptoBalance(decodeURIComponent(form.dataset.userEmail), form.dataset.asset, event.submitter.value, amount);
});

usersTableBody.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-user-email]');
    if (!deleteButton || deleteButton.tagName !== 'BUTTON') return;

    const email = deleteButton.dataset.userEmail;
    const confirmed = window.confirm(`Delete the account for ${email}? This action cannot be undone.`);
    if (confirmed) deleteUserAccount(email);
});

supportTableBody.addEventListener('submit', (event) => {
    const form = event.target.closest('.support-reply-form');
    if (!form) return;
    event.preventDefault();
    const reply = new FormData(form).get('reply')?.toString().trim();
    if (!reply) return;
    sendSupportReply(form.dataset.userEmail, reply);
    form.reset();
});

renderUsers();
renderRequests();
renderDepositAddressControls();
renderSupportBoard();

window.addEventListener('storage', (event) => {
    if (event.key === usersStorageKey) renderUsers();
    if (event.key === requestsStorageKey) renderRequests();
    if (event.key === supportStorageKey) renderSupportBoard();
    if (event.key === depositAddressesStorageKey) renderDepositAddressControls();
});
window.addEventListener('pageshow', () => {
    renderUsers();
    renderRequests();
    renderDepositAddressControls();
    renderSupportBoard();
});
