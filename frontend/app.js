const SESSION_KEY = "railnova_user";
const THEME_KEY = "railnova_theme";

const sampleTrains = [
  { name: "Rajdhani Express", number: "12952", from: "New Delhi", to: "Mumbai Central", depart: "16:55", arrive: "08:35", duration: 940, seats: 42, fare: 1840, days: "Mon, Tue, Thu, Sat", platform: 4 },
  { name: "Duronto Superfast", number: "12264", from: "New Delhi", to: "Mumbai Central", depart: "11:25", arrive: "04:10", duration: 1005, seats: 18, fare: 1620, days: "Daily", platform: 2 },
  { name: "Golden Temple Mail", number: "12904", from: "New Delhi", to: "Mumbai Central", depart: "19:40", arrive: "17:20", duration: 1300, seats: 65, fare: 980, days: "Daily", platform: 7 },
  { name: "Tejas Premium", number: "82901", from: "New Delhi", to: "Mumbai Central", depart: "06:15", arrive: "20:45", duration: 870, seats: 12, fare: 2340, days: "Wed, Fri, Sun", platform: 1 }
];
const routes = [
  ["New Delhi", "Mumbai Central", "₹980", "15h 40m"],
  ["Chennai Central", "Bengaluru City", "₹520", "5h 55m"],
  ["Howrah Junction", "New Delhi", "₹1,140", "17h 20m"],
  ["Pune Junction", "Hyderabad Deccan", "₹760", "10h 15m"]
];
const scheduleStops = [
  ["NDLS", "New Delhi", "16:55", "0 km", "Start"],
  ["KOTA", "Kota Jn", "21:42", "465 km", "05 min halt"],
  ["BRC", "Vadodara Jn", "04:10", "996 km", "08 min halt"],
  ["ST", "Surat", "05:43", "1,125 km", "03 min halt"],
  ["MMCT", "Mumbai Central", "08:35", "1,386 km", "End"]
];

const state = {
  user: loadUser(),
  bookings: [],
  selectedTrain: sampleTrains[0],
  selectedBooking: null,
  cities: [],
  trainResults: [...sampleTrains]
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const loader = $("#loader");
const authModal = $("#authModal");
const successModal = $("#successModal");
const toastStack = $("#toastStack");

function loadUser() {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  state.user = user;
}

function clearUser() {
  localStorage.removeItem(SESSION_KEY);
  state.user = null;
  state.bookings = [];
}

function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  toastStack.appendChild(item);
  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateX(24px)";
    setTimeout(() => item.remove(), 240);
  }, 3600);
}

function openSuccess(title, text) {
  $("#successTitle").textContent = title;
  $("#successText").textContent = text;
  successModal.classList.add("open");
  successModal.setAttribute("aria-hidden", "false");
}

function closeSuccess() {
  successModal.classList.remove("open");
  successModal.setAttribute("aria-hidden", "true");
}

function openAuth(mode = "login") {
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden", "false");
  switchAuth(mode);
}

function closeAuth() {
  authModal.classList.remove("open");
  authModal.setAttribute("aria-hidden", "true");
}

function switchAuth(mode) {
  const isLogin = mode === "login";
  $("#loginTab").classList.toggle("active", isLogin);
  $("#registerTab").classList.toggle("active", !isLogin);
  $("#loginForm").classList.toggle("active", isLogin);
  $("#registerForm").classList.toggle("active", !isLogin);
}

function routeTo(route) {
  $$(".main-nav a").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
  if (["home", "search", "tracking", "schedule", "support"].includes(route) && route !== "home") {
    if (!state.user) {
      openAuth("login");
      toast("Login to use the reservation workspace.", "error");
      return;
    }
    showPage("app");
    showAppSection(route);
    return;
  }
  showPage(route === "home" ? "home" : "app");
}

function showPage(pageId) {
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
}

function showAppSection(section) {
  if (!state.user) {
    openAuth("login");
    return;
  }

  const panelMap = {
    dashboard: "dashboardPanel",
    search: "searchPanel",
    booking: "bookingPanel",
    bookings: "bookingsPanel",
    ticket: "ticketPanel",
    tracking: "trackingPanel",
    schedule: "schedulePanel",
    profile: "profilePanel",
    support: "supportPanel"
  };

  showPage("app");
  $$(".app-panel").forEach((panel) => panel.classList.toggle("active", panel.id === panelMap[section]));
  $$(".side-link").forEach((button) => button.classList.toggle("active", button.dataset.appSection === section));
}

async function postForm(url, data) {
  const body = new URLSearchParams(data);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

async function loadBookings() {
  if (!state.user) return [];
  const res = await fetch(`/api/bookings?userId=${encodeURIComponent(state.user.id)}`);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Could not load bookings");
  state.bookings = payload.bookings || [];
  renderBookings();
  updateDashboard();
  return state.bookings;
}

async function cancelBooking(bookingId) {
  const res = await fetch(`/api/bookings?userId=${encodeURIComponent(state.user.id)}&bookingId=${encodeURIComponent(bookingId)}`, {
    method: "DELETE"
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Could not cancel booking");
}

async function fetchCities() {
  const res = await fetch("/api/cities");
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Could not load cities");
  state.cities = payload.cities || [];
  return state.cities;
}

async function fetchTrains(fromCity, toCity) {
  const params = new URLSearchParams();
  if (fromCity) params.set("from", fromCity);
  if (toCity) params.set("to", toCity);

  const res = await fetch(`/api/trains?${params.toString()}`);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Could not load trains");
  return payload.trains || [];
}

function populateCitySelects() {
  const cityOptions = state.cities.map((city) => `<option value="${city.name}">${city.name}</option>`).join("");

  $$("select[data-city-select]").forEach((select) => {
    const firstOption = select.querySelector("option[value='']");
    const firstOptionMarkup = firstOption ? firstOption.outerHTML : '<option value="">Select city</option>';
    const previousValue = select.value;

    select.innerHTML = `${firstOptionMarkup}${cityOptions}`;
    if (previousValue && state.cities.some((city) => city.name === previousValue)) {
      select.value = previousValue;
    }
  });
}

function renderPopularRoutes() {
  $("#popularRoutes").innerHTML = routes.map(([from, to, fare, time]) => `
    <article class="route-card">
      <small>${time} average</small>
      <strong>${from} to ${to}</strong>
      <p>Fares from ${fare}. Smart recommendation score: 94%.</p>
    </article>
  `).join("");
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function renderTrainResults(items = state.trainResults) {
  const container = $("#trainResults");
  if (!items.length) {
    container.innerHTML = `<div class="empty">No trains found for the selected source and destination.</div>`;
    return;
  }

  container.innerHTML = items.map((train) => `
    <article class="train-result">
      <div>
        <h3>${train.name}</h3>
        <p>#${train.number} - ${train.days || "Daily"}</p>
        <div class="result-meta">
          <span>${train.seats} seats</span>
          <span>Platform ${train.platform}</span>
          <span>Seat prediction: ${train.seats > 30 ? "High" : "Limited"}</span>
        </div>
      </div>
      <div>
        <div class="train-times"><strong>${train.depart}</strong><span></span><strong>${train.arrive}</strong></div>
        <p>${train.from} to ${train.to} - ${formatDuration(train.duration)}</p>
      </div>
      <div>
        <h3>Rs ${train.fare}</h3>
        <button class="btn btn-primary book-train-btn" data-train="${train.number}" type="button">Book Now</button>
      </div>
    </article>
  `).join("");
}

function sortedTrains() {
  const key = $("#sortSelect").value;
  const copy = [...state.trainResults];
  if (key === "fare") return copy.sort((a, b) => a.fare - b.fare);
  if (key === "duration") return copy.sort((a, b) => a.duration - b.duration);
  if (key === "seats") return copy.sort((a, b) => b.seats - a.seats);
  return copy.sort((a, b) => a.depart.localeCompare(b.depart));
}

function renderSeatMap() {
  const seats = Array.from({ length: 24 }, (_, index) => {
    const seat = index + 1;
    const selected = [2, 7, 14].includes(seat);
    const available = ![5, 11, 19, 22].includes(seat);
    return `<span class="seat ${selected ? "selected" : available ? "available" : ""}">${seat}</span>`;
  });
  $("#seatMap").innerHTML = seats.join("");
}

function renderTrackingTimeline() {
  $("#trackingTimeline").innerHTML = scheduleStops.map((stop, index) => `
    <article class="${index === 2 ? "active" : ""}">
      <span></span>
      <strong>${stop[0]}</strong>
      <p>${stop[1]}</p>
      <small>${stop[2]}</small>
    </article>
  `).join("");
}

function renderSchedule() {
  $("#scheduleList").innerHTML = scheduleStops.map((stop) => `
    <article class="schedule-item">
      <div><h3>${stop[0]}</h3><p>${stop[3]}</p></div>
      <div><strong>${stop[1]}</strong><p>${stop[4]}</p></div>
      <div><p>Arrival / Departure</p><h3>${stop[2]}</h3></div>
    </article>
  `).join("");
}

function renderBookings() {
  const filter = ($("#bookingFilter")?.value || "").toLowerCase();
  const bookings = state.bookings.filter((booking) => {
    const text = `${booking.id} ${booking.source} ${booking.destination} ${booking.journeyDate}`.toLowerCase();
    return text.includes(filter);
  });
  const target = $("#bookingBody");
  const recent = $("#recentBookings");

  if (!bookings.length) {
    const empty = `<div class="empty">No bookings found. Your upcoming journey cards will appear here after booking.</div>`;
    target.innerHTML = empty;
    recent.innerHTML = empty;
    return;
  }

  const markup = bookings.map((booking) => `
    <article class="booking-item">
      <div>
        <h3>${booking.source} to ${booking.destination}</h3>
        <p>Booking ID: RN-${String(booking.id).padStart(5, "0")} · ${booking.journeyDate}</p>
        <div class="result-meta"><span>Confirmed</span><span>${booking.seats} passenger${booking.seats > 1 ? "s" : ""}</span><span>PNR ready</span></div>
      </div>
      <div>
        <div class="train-times"><strong>${booking.source.slice(0, 4).toUpperCase()}</strong><span></span><strong>${booking.destination.slice(0, 4).toUpperCase()}</strong></div>
        <p>Fare prediction stable · Platform details near departure</p>
      </div>
      <div class="booking-actions">
        <button type="button" data-ticket-id="${booking.id}">View</button>
        <button type="button">Download</button>
        <button type="button">Rebook</button>
        <button type="button" class="cancel-btn" data-booking-id="${booking.id}">Cancel</button>
      </div>
    </article>
  `).join("");
  target.innerHTML = markup;
  recent.innerHTML = markup;
}

function updateDashboard() {
  const user = state.user;
  $("#authOpenBtn").classList.toggle("hidden", Boolean(user));
  $("#logoutBtn").classList.toggle("hidden", !user);
  $("#welcomeText").textContent = user ? `Welcome, ${user.name}` : "Welcome aboard";
  $("#miniName").textContent = user ? user.name : "Guest";
  $("#miniEmail").textContent = user ? user.email : "Please login";
  $("#userInitial").textContent = user?.name?.slice(0, 1).toUpperCase() || "G";
  $("#profileName").value = user?.name || "";
  $("#profileEmail").value = user?.email || "";
  $("#totalBookings").textContent = String(state.bookings.length);
  $("#rewardPoints").textContent = String(1240 + state.bookings.length * 80);

  if (!state.bookings.length) {
    $("#nextJourney").textContent = "-";
  } else {
    const upcoming = [...state.bookings].sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate));
    $("#nextJourney").textContent = upcoming[0].journeyDate;
    updateTicket(upcoming[0]);
  }
}

function updateTicket(booking) {
  if (!booking) return;
  state.selectedBooking = booking;
  $("#ticketRoute").textContent = `${booking.source} to ${booking.destination}`;
  $("#ticketPnr").textContent = `RN${String(booking.id).padStart(6, "0")}`;
  $("#ticketSource").textContent = booking.source.slice(0, 4).toUpperCase();
  $("#ticketDestination").textContent = booking.destination.slice(0, 4).toUpperCase();
  $("#ticketDate").textContent = `Departure: ${booking.journeyDate} · Passenger count: ${booking.seats} · Coach: A1`;
}

function setDefaultDates() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const value = tomorrow.toISOString().slice(0, 10);
  $$("input[type='date']").forEach((input) => {
    if (!input.value) input.value = value;
  });
}

async function runTrainSearch({ from, to }) {
  $("#resultSkeleton").classList.remove("hidden");
  $("#trainResults").innerHTML = "";
  try {
    state.trainResults = await fetchTrains(from, to);
    $("#resultSkeleton").classList.add("hidden");
    renderTrainResults(sortedTrains());
    toast("Trains loaded for selected cities.", "success");
  } catch (err) {
    $("#resultSkeleton").classList.add("hidden");
    state.trainResults = [];
    renderTrainResults([]);
    toast(err.message, "error");
  }
}

function bindEvents() {
  window.addEventListener("load", () => setTimeout(() => loader.classList.add("done"), 650));

  $("#menuBtn").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("light");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("light") ? "light" : "dark");
  });

  $$("#mainNav a, [data-route]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const route = element.dataset.route;
      if (!route) return;
      event.preventDefault();
      routeTo(route);
    });
  });

  $("[data-route='home']").addEventListener("click", () => routeTo("home"));
  $("#authOpenBtn").addEventListener("click", () => openAuth("login"));
  $("#closeAuth").addEventListener("click", closeAuth);
  $("#successClose").addEventListener("click", closeSuccess);
  authModal.addEventListener("click", (event) => { if (event.target === authModal) closeAuth(); });
  successModal.addEventListener("click", (event) => { if (event.target === successModal) closeSuccess(); });
  $("#loginTab").addEventListener("click", () => switchAuth("login"));
  $("#registerTab").addEventListener("click", () => switchAuth("register"));

  $$(".pass-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Show" : "Hide";
    });
  });

  $$(".side-link, [data-app-section]").forEach((button) => {
    button.addEventListener("click", () => showAppSection(button.dataset.appSection));
  });

  $("#homeSearchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user) {
      openAuth("login");
      toast("Login first, then your train search opens automatically.", "error");
      return;
    }

    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    const searchForm = $("#trainSearchForm");
    searchForm.from.value = formData.from;
    searchForm.to.value = formData.to;
    if (formData.date) searchForm.date.value = formData.date;

    showAppSection("search");
    await runTrainSearch({ from: formData.from, to: formData.to });
  });

  $("#voiceBtn").addEventListener("click", () => toast("Voice search UI is ready. Connect Web Speech API when needed.", "success"));

  $("#trainSearchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    await runTrainSearch({ from: formData.from, to: formData.to });
  });

  $("#sortSelect").addEventListener("change", () => renderTrainResults(sortedTrains()));

  $("#trainResults").addEventListener("click", (event) => {
    const button = event.target.closest(".book-train-btn");
    if (!button) return;
    state.selectedTrain = state.trainResults.find((train) => train.number === button.dataset.train) || state.trainResults[0] || sampleTrains[0];
    const form = $("#bookingForm");
    form.source.value = state.selectedTrain.from;
    form.destination.value = state.selectedTrain.to;
    showAppSection("booking");
    toast(`${state.selectedTrain.name} selected for booking.`, "success");
  });

  $("#bookingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user) return openAuth("login");
    const form = event.currentTarget;
    const formData = Object.fromEntries(new FormData(form).entries());
    const apiData = {
      userId: state.user.id,
      source: formData.source,
      destination: formData.destination,
      journeyDate: formData.journeyDate,
      seats: formData.seats
    };
    try {
      await postForm("/api/bookings", apiData);
      form.reset();
      setDefaultDates();
      await loadBookings();
      openSuccess("Booking confirmed", "Your ticket was booked successfully and is available in My Bookings.");
      showAppSection("bookings");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  $("#bookingBody").addEventListener("click", handleBookingActions);
  $("#recentBookings").addEventListener("click", handleBookingActions);
  $("#bookingFilter").addEventListener("input", renderBookings);
  $("#refreshBtn").addEventListener("click", async () => {
    try {
      await loadBookings();
      toast("Booking history refreshed.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  $("#trackingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    toast("Live tracking refreshed. Map provider hook is ready.", "success");
  });

  $("#logoutBtn").addEventListener("click", () => {
    clearUser();
    updateDashboard();
    renderBookings();
    routeTo("home");
    toast("Logged out successfully.", "success");
  });

  $("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = Object.fromEntries(new FormData(form).entries());
    try {
      await postForm("/api/register", formData);
      form.reset();
      switchAuth("login");
      toast("Registration successful. Please login to continue.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = Object.fromEntries(new FormData(form).entries());
    try {
      const data = await postForm("/api/login", formData);
      saveUser(data.user);
      closeAuth();
      await loadBookings();
      showAppSection("dashboard");
      toast("Login successful. Welcome aboard.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

async function handleBookingActions(event) {
  const cancelButton = event.target.closest("[data-booking-id]");
  const ticketButton = event.target.closest("[data-ticket-id]");

  if (ticketButton) {
    const booking = state.bookings.find((item) => String(item.id) === String(ticketButton.dataset.ticketId));
    updateTicket(booking);
    showAppSection("ticket");
    return;
  }

  if (!cancelButton) return;
  const bookingId = cancelButton.dataset.bookingId;
  if (!window.confirm("Do you want to cancel this booking?")) return;

  try {
    await cancelBooking(bookingId);
    await loadBookings();
    toast("Booking cancelled successfully.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach((item) => observer.observe(item));
}

async function init() {
  if (localStorage.getItem(THEME_KEY) === "light") document.body.classList.add("light");
  bindEvents();
  renderPopularRoutes();
  renderSeatMap();
  renderTrackingTimeline();
  renderSchedule();
  setDefaultDates();
  initReveal();
  updateDashboard();
  renderBookings();

  try {
    await fetchCities();
    populateCitySelects();

    const searchForm = $("#trainSearchForm");
    if (state.cities.length >= 2) {
      if (!searchForm.from.value) searchForm.from.value = state.cities[0].name;
      if (!searchForm.to.value) searchForm.to.value = state.cities[1].name;
    }

    const initialFrom = searchForm.from.value;
    const initialTo = searchForm.to.value;
    if (initialFrom && initialTo) {
      state.trainResults = await fetchTrains(initialFrom, initialTo);
      renderTrainResults(sortedTrains());
    } else {
      renderTrainResults([]);
    }
  } catch (err) {
    state.trainResults = [...sampleTrains];
    renderTrainResults(sortedTrains());
    toast(`Live city list unavailable: ${err.message}`, "error");
  }

  if (state.user) {
    try {
      await loadBookings();
    } catch (err) {
      clearUser();
      updateDashboard();
      toast("Session restored, but bookings could not load. Please login again.", "error");
    }
  }
}

init();

