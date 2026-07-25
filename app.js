// Spare Parts Store - Single-file app logic
// Admin credentials are embedded here as requested:
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

// LocalStorage keys
const LS_KEYS = {
  PRODUCTS: "sp_parts_products",
  USERS: "sp_parts_users",
  SETTINGS: "sp_parts_settings",
  ORDERS: "sp_parts_orders",
  CART: "sp_parts_cart"
};

// Utility helpers
const $ = id => document.getElementById(id);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, fallback) => {
  const raw = localStorage.getItem(k);
  return raw ? JSON.parse(raw) : fallback;
};

// Initialize defaults if missing
function seedDefaults() {
  if (!load(LS_KEYS.SETTINGS)) {
    save(LS_KEYS.SETTINGS, {
      title: "Spare Parts Store",
      currency: "$",
      logoDataUrl: null,
      heroDataUrl: null
    });
  }
  if (!load(LS_KEYS.PRODUCTS)) {
    save(LS_KEYS.PRODUCTS, [
      { id: "p1", name: "Brake Pad Set", category: "Brakes", price: 45.00, stock: 15, description: "High-quality brake pads for standard models.", img: null },
      { id: "p2", name: "Oil Filter", category: "Engine", price: 9.50, stock: 60, description: "Replace every oil change.", img: null },
      { id: "p3", name: "Air Filter", category: "Engine", price: 12.75, stock: 40, description: "Protect engine from dust and debris.", img: null }
    ]);
  }
  if (!load(LS_KEYS.USERS)) {
    // one sample user
    save(LS_KEYS.USERS, [
      { id: uid(), username: "jdoe", fullName: "John Doe", password: "password", isAdmin: false, createdAt: Date.now(), orders: [] }
    ]);
  }
  if (!load(LS_KEYS.ORDERS)) {
    save(LS_KEYS.ORDERS, []);
  }
  if (!load(LS_KEYS.CART)) {
    save(LS_KEYS.CART, {});
  }
}

function uid(prefix="id") {
  return prefix + "_" + Math.random().toString(36).slice(2,9);
}

function formatCurrency(v) {
  const settings = load(LS_KEYS.SETTINGS);
  return `${settings.currency}${Number(v).toFixed(2)}`;
}

// UI state
let state = {
  page: "login", // login, shop, cart, user, admin
  currentUser: null // user object, or special admin token
};

// Bootstrap
seedDefaults();
renderFromSettings();
bindNav();
renderLogin();

// NAV & top actions
function bindNav() {
  $("navLogin")?.addEventListener("click", () => goTo("login"));
  $("navShop")?.addEventListener("click", () => goTo("shop"));
  $("navCart")?.addEventListener("click", () => goTo("cart"));
  $("logoutBtn")?.addEventListener("click", () => { logout(); });
  $("footerYear").textContent = new Date().getFullYear();
}

function goTo(page) {
  state.page = page;
  updateView();
}
function updateView() {
  // hide all panels
  ["loginSection","shopSection","cartSection","userSection","adminSection"].forEach(id => $(id) && ($(id).hidden = true));
  if (state.page === "login") {
    $("loginSection").hidden = false;
  } else if (state.page === "shop") {
    $("shopSection").hidden = false;
    renderProducts();
  } else if (state.page === "cart") {
    $("cartSection").hidden = false;
    renderCart();
  } else if (state.page === "user") {
    $("userSection").hidden = false;
    renderUserDashboard();
  } else if (state.page === "admin") {
    $("adminSection").hidden = false;
    $("adminArea").innerHTML = "";
  }
  // top bar user display
  const isLoggedIn = !!state.currentUser;
  $("navLogin").hidden = isLoggedIn;
  $("userNameDisplay").hidden = !isLoggedIn;
  if (isLoggedIn) {
    const name = state.currentUser.isAdmin ? "Admin" : state.currentUser.fullName || state.currentUser.username;
    $("currentUserName").textContent = name;
  }
  // cart count
  const cart = load(LS_KEYS.CART, {});
  const count = Object.values(cart).reduce((s,i)=>s+i.qty,0);
  $("cartCount").textContent = count;
}

// LOGIN / REGISTER
function renderLogin() {
  // tabs
  $("tabLogin").addEventListener("click", ()=>{ $("tabLogin").classList.add("active"); $("tabRegister").classList.remove("active"); $("loginForm").hidden=false; $("registerForm").hidden=true;});
  $("tabRegister").addEventListener("click", ()=>{ $("tabRegister").classList.add("active"); $("tabLogin").classList.remove("active"); $("registerForm").hidden=false; $("loginForm").hidden=true;});
  // actions
  $("loginBtn").addEventListener("click", attemptLogin);
  $("registerBtn").addEventListener("click", attemptRegister);
}

function attemptLogin(){
  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;
  if (!username || !password) return alert("Enter username and password");
  // check admin first (hardcoded)
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    state.currentUser = { id: "admin", username: ADMIN_USERNAME, isAdmin: true };
    goTo("admin");
    updateView();
    return;
  }
  // check users
  const users = load(LS_KEYS.USERS, []);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return alert("Invalid credentials");
  state.currentUser = user;
  goTo("shop");
  updateView();
}

function attemptRegister(){
  const fullName = $("regFullName").value.trim();
  const username = $("regUsername").value.trim();
  const password = $("regPassword").value;
  if (!username || !password || !fullName) return alert("All fields required");
  const users = load(LS_KEYS.USERS, []);
  if (users.some(u=>u.username===username)) return alert("Username already exists");
  const user = { id: uid("user"), username, fullName, password, isAdmin:false, createdAt:Date.now(), orders:[] };
  users.push(user);
  save(LS_KEYS.USERS, users);
  alert("Account created — you can login now");
  // switch to login tab
  $("tabLogin").click();
}

// LOGOUT
function logout(){
  state.currentUser = null;
  goTo("login");
  updateView();
}

// SHOP / PRODUCTS
function renderProducts(){
  const products = load(LS_KEYS.PRODUCTS, []);
  const categories = Array.from(new Set(products.map(p => p.category))).sort();
  const catSelect = $("filterCategory");
  catSelect.innerHTML = `<option value="">All</option>` + categories.map(c=>`<option value="${c}">${c}</option>`).join("");
  $("searchInput").oninput = renderProducts;
  $("filterCategory").onchange = renderProducts;

  const q = $("searchInput").value.trim().toLowerCase();
  const selCat = $("filterCategory").value;
  const filtered = products.filter(p=>{
    const inCat = selCat ? p.category===selCat : true;
    const inQ = q ? (p.name.toLowerCase().includes(q) || (p.description||"").toLowerCase().includes(q)) : true;
    return inCat && inQ;
  });

  const grid = $("productsGrid");
  grid.innerHTML = "";
  filtered.forEach(p=>{
    const card = document.createElement("div");
    card.className = "card";
    const img = document.createElement("img");
    img.src = p.img || p.imgDataUrl || "https://via.placeholder.com/400x300?text=Part";
    img.alt = p.name;
    const h = document.createElement("h4"); h.textContent = p.name;
    const desc = document.createElement("div"); desc.className="meta"; desc.textContent = p.category + " • " + (p.description || "");
    const price = document.createElement("div"); price.className="price"; price.textContent = formatCurrency(p.price);
    const actions = document.createElement("div"); actions.className="actions";
    const addBtn = document.createElement("button"); addBtn.className="primary"; addBtn.textContent="Add to cart";
    addBtn.onclick = ()=> addToCart(p.id);
    const viewBtn = document.createElement("button"); viewBtn.className="secondary"; viewBtn.textContent="Details";
    viewBtn.onclick = ()=> showProductDetails(p);
    actions.append(addBtn, viewBtn);
    card.append(img,h,desc,price,actions);
    grid.appendChild(card);
  });
}

function showProductDetails(p){
  openModal(`
    <h3>${p.name}</h3>
    <div style="display:flex;gap:12px;align-items:flex-start">
      <img style="width:220px;height:160px;object-fit:cover;border-radius:8px" src="${p.img || p.imgDataUrl || "https://via.placeholder.com/400x300?text=Part"}" />
      <div>
        <p><strong>Category:</strong> ${p.category}</p>
        <p><strong>Price:</strong> ${formatCurrency(p.price)}</p>
        <p>${p.description || ""}</p>
        <div style="margin-top:12px">
          <button id="modalAddCart" class="primary">Add to cart</button>
        </div>
      </div>
    </div>
  `);
  $("modalAddCart").addEventListener("click", ()=>{
    addToCart(p.id);
    closeModal();
  });
}

// CART
function getCart(){
  return load(LS_KEYS.CART, {});
}
function saveCart(cart){ save(LS_KEYS.CART, cart); updateView(); }

function addToCart(productId, qty=1){
  const products = load(LS_KEYS.PRODUCTS);
  const p = products.find(x=>x.id===productId);
  if(!p) return alert("Product not found");
  const cart = getCart();
  if(cart[productId]) cart[productId].qty += qty;
  else cart[productId] = { productId, qty };
  saveCart(cart);
  alert("Added to cart");
  renderCart();
}

function renderCart(){
  const cart = getCart();
  const products = load(LS_KEYS.PRODUCTS);
  const list = $("cartList");
  list.innerHTML = "";
  let total = 0;
  if (Object.keys(cart).length === 0) {
    list.textContent = "Your cart is empty.";
    $("cartTotal").querySelector("span").textContent = formatCurrency(0);
    return;
  }
  Object.values(cart).forEach(item=>{
    const p = products.find(x=>x.id===item.productId);
    if(!p) return;
    const row = document.createElement("div");
    row.className = "card";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${p.img || p.imgDataUrl || 'https://via.placeholder.com/120'}" style="height:60px;width:80px;object-fit:cover;border-radius:6px">
        <div>
          <div style="font-weight:700">${p.name}</div>
          <div class="meta">${p.category} • ${formatCurrency(p.price)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" min="1" value="${item.qty}" style="width:70px;padding:6px;border-radius:6px;border:1px solid #eee" data-pid="${p.id}">
        <button data-remove="${p.id}" class="secondary">Remove</button>
      </div>
    `;
    list.appendChild(row);
    total += p.price * item.qty;
  });
  // attach events
  list.querySelectorAll('input[type="number"]').forEach(inp=>{
    inp.addEventListener("change", (e)=>{
      const pid = e.target.dataset.pid;
      const val = Math.max(1, Number(e.target.value) || 1);
      const cart = getCart();
      cart[pid].qty = val;
      saveCart(cart);
      renderCart();
    });
  });
  list.querySelectorAll('[data-remove]').forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const pid = btn.dataset.remove;
      const cart = getCart();
      delete cart[pid];
      saveCart(cart);
      renderCart();
    });
  });

  $("cartTotal").querySelector("span").textContent = formatCurrency(total);
  $("checkoutBtn").onclick = checkout;
  $("clearCartBtn").onclick = ()=>{
    saveCart({});
    renderCart();
  };
}

function checkout(){
  if (!state.currentUser) {
    if (!confirm("You must be logged in to checkout. Go to login?")) return;
    goTo("login");
    return;
  }
  const cart = getCart();
  const products = load(LS_KEYS.PRODUCTS);
  let total = 0;
  const items = [];
  for (const key in cart) {
    const p = products.find(pp=>pp.id===key);
    if (!p) continue;
    const qty = cart[key].qty;
    items.push({ productId: p.id, qty, price: p.price, name: p.name });
    total += qty * p.price;
  }
  const order = { id: uid("ord"), userId: state.currentUser.id, items, total, createdAt: Date.now(), status: "Placed" };
  const orders = load(LS_KEYS.ORDERS, []);
  orders.push(order);
  save(LS_KEYS.ORDERS, orders);
  // store in user's orders
  if (!state.currentUser.isAdmin) {
    const users = load(LS_KEYS.USERS);
    const uidx = users.findIndex(u=>u.id===state.currentUser.id);
    if (uidx >= 0) {
      users[uidx].orders = users[uidx].orders || [];
      users[uidx].orders.push(order.id);
      save(LS_KEYS.USERS, users);
      state.currentUser = users[uidx];
    }
  }
  saveCart({});
  alert("Order placed successfully!");
  goTo(state.currentUser.isAdmin ? "admin" : "user");
  renderUserDashboard();
}

// USER DASHBOARD
function renderUserDashboard(){
  const user = state.currentUser;
  if (!user) { goTo("login"); return; }
  const orders = load(LS_KEYS.ORDERS, []);
  const myOrders = orders.filter(o=>o.userId===user.id);
  const div = $("userOrders");
  if (!myOrders.length) {
    div.textContent = "No orders yet.";
  } else {
    div.innerHTML = myOrders.map(o=>{
      return `<div class="card"><div><strong>Order ${o.id}</strong> — ${new Date(o.createdAt).toLocaleString()} — ${formatCurrency(o.total)}</div>
        <div style="margin-top:8px">${o.items.map(i=>`<div>${i.qty} × ${i.name} — ${formatCurrency(i.price)}</div>`).join("")}</div>
      </div>`;
    }).join("");
  }
  $("userAccountInfo").innerHTML = `<div class="card"><strong>${user.fullName || user.username}</strong><div class="meta">Member since ${new Date(user.createdAt).toLocaleDateString()}</div></div>`;
}

// ADMIN AREA and MODALS
function openModal(html){
  $("modalBody").innerHTML = html;
  $("modal").hidden = false;
  $("modalClose").onclick = closeModal;
}
function closeModal(){
  $("modal").hidden = true;
  $("modalBody").innerHTML = "";
}

(function bindAdminButtons(){
  // attach when admin panel opens
  document.addEventListener('click', (e)=>{
    if (e.target && e.target.id === 'openSettings') {
      showAdminSettings();
    }
    if (e.target && e.target.id === 'openProducts') {
      showAdminProducts();
    }
    if (e.target && e.target.id === 'openUsers') {
      showAdminUsers();
    }
    if (e.target && e.target.id === 'openOrders') {
      showAdminOrders();
    }
  });
})();

function showAdminSettings(){
  const settings = load(LS_KEYS.SETTINGS);
  openModal(`
    <h3>Site Settings</h3>
    <div style="display:flex;gap:16px">
      <div style="flex:1">
        <label>Site title</label>
        <input id="settingTitle" value="${escapeHtml(settings.title)}" />
        <label>Currency symbol</label>
        <input id="settingCurrency" value="${escapeHtml(settings.currency)}" />
        <label>Upload logo (PNG/JPG)</label>
        <input id="settingLogo" type="file" accept="image/*" />
        <div style="height:12px"></div>
        <label>Upload hero image</label>
        <input id="settingHero" type="file" accept="image/*" />
        <div style="height:12px"></div>
        <button id="saveSettings" class="primary">Save Settings</button>
      </div>
      <div style="width:260px">
        <div style="font-size:13px;color:#666">Preview</div>
        <div style="margin-top:8px">
          <img id="previewLogo" src="${settings.logoDataUrl || 'logo.png'}" style="height:64px;object-fit:contain;border-radius:6px;display:block;margin-bottom:8px" onerror="this.style.display='none'">
          <img id="previewHero" src="${settings.heroDataUrl || 'hero.jpg'}" style="width:100%;height:120px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'">
        </div>
      </div>
    </div>
  `);
  // handle file previews + save
  $("settingLogo").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => $("previewLogo").src = ev.target.result;
    reader.readAsDataURL(f);
  });
  $("settingHero").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => $("previewHero").src = ev.target.result;
    reader.readAsDataURL(f);
  });
  $("saveSettings").onclick = ()=>{
    const title = $("settingTitle").value.trim() || "Spare Parts Store";
    const currency = $("settingCurrency").value.trim() || "$";
    const settings = load(LS_KEYS.SETTINGS);
    settings.title = title;
    settings.currency = currency;
    // check previews and convert to data urls if files were chosen
    const saveFiles = () => {
      const previewLogo = $("previewLogo").src;
      const previewHero = $("previewHero").src;
      settings.logoDataUrl = previewLogo.indexOf("data:")===0 ? previewLogo : settings.logoDataUrl;
      settings.heroDataUrl = previewHero.indexOf("data:")===0 ? previewHero : settings.heroDataUrl;
      save(LS_KEYS.SETTINGS, settings);
      renderFromSettings();
      closeModal();
      alert("Settings saved.");
    };
    // If inputs had selected files, convert to data URLs then save
    const logoInput = $("settingLogo");
    const heroInput = $("settingHero");
    if (logoInput.files && logoInput.files[0]) {
      const r = new FileReader();
      r.onload = e => {
        settings.logoDataUrl = e.target.result;
        if (heroInput.files && heroInput.files[0]) {
          const rh = new FileReader();
          rh.onload = eh=>{ settings.heroDataUrl = eh.target.result; save(LS_KEYS.SETTINGS, settings); renderFromSettings(); closeModal(); alert("Settings saved."); };
          rh.readAsDataURL(heroInput.files[0]);
        } else { save(LS_KEYS.SETTINGS, settings); renderFromSettings(); closeModal(); alert("Settings saved."); }
      };
      r.readAsDataURL(logoInput.files[0]);
    } else if (heroInput.files && heroInput.files[0]) {
      const rh = new FileReader();
      rh.onload = eh => { settings.heroDataUrl = eh.target.result; save(LS_KEYS.SETTINGS, settings); renderFromSettings(); closeModal(); alert("Settings saved."); };
      rh.readAsDataURL(heroInput.files[0]);
    } else {
      saveFiles();
    }
  };
}

function showAdminProducts(){
  const products = load(LS_KEYS.PRODUCTS);
  openModal(`
    <h3>Manage Products</h3>
    <div style="display:flex;gap:12px">
      <div style="flex:1">
        <div id="productsList" style="display:grid;gap:8px;max-height:420px;overflow:auto"></div>
        <div style="margin-top:10px"><button id="addProduct" class="primary">Add Product</button></div>
      </div>
      <div style="width:360px">
        <h4>Product Editor</h4>
        <div id="editorArea">Select a product or click Add Product.</div>
      </div>
    </div>
  `);
  renderProductsList();
  $("addProduct").onclick = ()=> openProductEditor();
  function renderProductsList(){
    const pList = $("productsList");
    pList.innerHTML = "";
    (load(LS_KEYS.PRODUCTS) || []).forEach(p=>{
      const el = document.createElement("div");
      el.className = "card";
      el.style.display = "flex";
      el.style.justifyContent = "space-between";
      el.innerHTML = `<div><strong>${p.name}</strong><div class="meta">${p.category} • ${formatCurrency(p.price)}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button data-edit="${p.id}" class="secondary">Edit</button>
        <button data-del="${p.id}" class="danger">Delete</button>
      </div>`;
      pList.appendChild(el);
    });
    pList.querySelectorAll('[data-edit]').forEach(btn=>{
      btn.onclick = ()=> openProductEditor(btn.dataset.edit);
    });
    pList.querySelectorAll('[data-del]').forEach(btn=>{
      btn.onclick = ()=>{
        if (!confirm("Delete product?")) return;
        const arr = load(LS_KEYS.PRODUCTS).filter(x=>x.id!==btn.dataset.del);
        save(LS_KEYS.PRODUCTS, arr);
        renderProductsList();
      };
    });
  }
  function openProductEditor(productId){
    const editor = $("editorArea");
    const products = load(LS_KEYS.PRODUCTS);
    const p = products.find(x=>x.id===productId) || { id: uid("p"), name:"", category:"", price:0, stock:0, description:"", imgDataUrl:null };
    editor.innerHTML = `
      <label>Name</label><input id="prodName" value="${escapeHtml(p.name)}" />
      <label>Category</label><input id="prodCategory" value="${escapeHtml(p.category)}" />
      <label>Price</label><input id="prodPrice" type="number" value="${p.price}" />
      <label>Stock</label><input id="prodStock" type="number" value="${p.stock}" />
      <label>Description</label><textarea id="prodDesc">${escapeHtml(p.description)}</textarea>
      <label>Image</label><input id="prodImage" type="file" accept="image/*" />
      <div style="margin-top:8px"><img id="prodPreview" src="${p.imgDataUrl || p.img || 'https://via.placeholder.com/280x180'}" style="width:100%;height:160px;object-fit:cover;border-radius:6px" /></div>
      <div style="margin-top:8px"><button id="saveProd" class="primary">Save</button></div>
    `;
    $("prodImage").onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = ev => $("prodPreview").src = ev.target.result;
      r.readAsDataURL(f);
    };
    $("saveProd").onclick = ()=>{
      p.name = $("prodName").value.trim();
      p.category = $("prodCategory").value.trim();
      p.price = Number($("prodPrice").value) || 0;
      p.stock = Number($("prodStock").value) || 0;
      p.description = $("prodDesc").value.trim();
      // if file selected, convert to data url
      const fileInput = $("prodImage");
      if (fileInput.files && fileInput.files[0]) {
        const r = new FileReader();
        r.onload = ev => {
          p.imgDataUrl = ev.target.result;
          persist();
        };
        r.readAsDataURL(fileInput.files[0]);
      } else {
        p.imgDataUrl = $("prodPreview").src.indexOf("data:")===0 ? $("prodPreview").src : p.imgDataUrl;
        persist();
      }
      function persist(){
        const arr = load(LS_KEYS.PRODUCTS).filter(x=>x.id!==p.id);
        arr.push(p);
        save(LS_KEYS.PRODUCTS, arr);
        renderProductsList();
        renderProducts();
        alert("Product saved");
      }
    };
  }
}

function showAdminUsers(){
  const users = load(LS_KEYS.USERS);
  openModal(`
    <h3>Manage Users</h3>
    <div style="display:flex;gap:12px">
      <div style="flex:1">
        <div id="usersList" style="display:grid;gap:8px;max-height:480px;overflow:auto"></div>
      </div>
      <div style="width:360px">
        <h4>User Actions</h4>
        <div id="userActions">Select a user to manage</div>
      </div>
    </div>
  `);
  renderUsersList();
  function renderUsersList(){
    const list = $("usersList");
    list.innerHTML = "";
    (load(LS_KEYS.USERS) || []).forEach(u=>{
      const el = document.createElement("div");
      el.className = "card";
      el.style.display = "flex";
      el.style.justifyContent = "space-between";
      el.innerHTML = `<div><strong>${u.fullName}</strong><div class="meta">${u.username} • ${new Date(u.createdAt).toLocaleDateString()}</div></div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button data-id="${u.id}" class="secondary">Open as user</button>
          <button data-del="${u.id}" class="danger">Delete</button>
        </div>`;
      list.appendChild(el);
    });
    list.querySelectorAll('[data-id]').forEach(btn=>{
      btn.onclick = ()=> {
        const uid = btn.dataset.id;
        // open as user (impersonate): the admin can access user-like panel
        const users = load(LS_KEYS.USERS);
        const user = users.find(x=>x.id===uid);
        if (!user) return alert("User not found");
        // set state.currentUser to that user but retain admin in session (for production you'd need a better impersonation)
        state.currentUser = user;
        closeModal();
        goTo("user");
        updateView();
        alert("You are viewing the site as this user. To return to admin, logout and login as admin again.");
      };
    });
    list.querySelectorAll('[data-del]').forEach(btn=>{
      btn.onclick = ()=> {
        if (!confirm("Delete user?")) return;
        const newArr = load(LS_KEYS.USERS).filter(x=>x.id!==btn.dataset.del);
        save(LS_KEYS.USERS, newArr);
        renderUsersList();
      };
    });
  }
}

function showAdminOrders(){
  const orders = load(LS_KEYS.ORDERS, []);
  openModal(`
    <h3>Orders</h3>
    <div id="ordersList" style="display:grid;gap:10px;max-height:560px;overflow:auto"></div>
  `);
  const list = $("ordersList");
  if (!orders.length) list.textContent = "No orders placed yet.";
  else {
    list.innerHTML = orders.map(o=>{
      return `<div class="card"><div style="display:flex;justify-content:space-between"><strong>Order ${o.id}</strong><div>${formatCurrency(o.total)}</div></div>
        <div class="meta">${new Date(o.createdAt).toLocaleString()} • Status: ${o.status}</div>
        <div style="margin-top:8px">${o.items.map(i=>`<div>${i.qty} × ${i.name} — ${formatCurrency(i.price)}</div>`).join("")}</div>
      </div>`;
    }).join("");
  }
}

// Helper to apply site settings (title/logo)
function renderFromSettings(){
  const settings = load(LS_KEYS.SETTINGS);
  $("siteTitle").textContent = settings.title || "Spare Parts Store";
  $("footerTitle").textContent = settings.title || "Spare Parts Store";
  if (settings.logoDataUrl) {
    $("logoImg").src = settings.logoDataUrl;
    $("logoImg").style.display = "";
  } else {
    $("logoImg").src = "logo.png";
  }
  if (settings.heroDataUrl) {
    $("heroImg").src = settings.heroDataUrl;
  } else {
    $("heroImg").src = "hero.jpg";
  }
}

// Escape helper to avoid breaking inputs
function escapeHtml(s){
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Initialize view toggle buttons and modal close
$("modal") && ($("modal").addEventListener("click", (e)=>{ if (e.target=== $("modal")) closeModal(); }));
$("modalClose") && ($("modalClose").addEventListener("click", closeModal));

// On initial load, show shop if not logged in
renderProducts();
updateView();

// small shim to ensure index toggles
// Expose goTo for console testing
window.goTo = goTo;
window.appState = state;
window.loadLS = load;
window.saveLS = save;
window.LS_KEYS = LS_KEYS;