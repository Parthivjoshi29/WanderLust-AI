const HUGGINGFACE_API_KEY = "YOUR_HUGGINGFACE_API_KEY";

let map, routeControl; // Updated global variables
let destinations = []; // Array to store destination coordinates
let markers = []; // Array to store markers

document.addEventListener("DOMContentLoaded", () => {
  // Initialize map
  initializeMap();

  // Initialize theme toggle
  initializeThemeToggle();

  // Initialize destination handlers
  initializeDestinationHandlers();
});

function initializeMap() {
  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true,
    zoomAnimation: true,
  }).setView([48.8566, 2.3522], 4); // Zoomed out to show more of the world

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "©OpenStreetMap, ©CartoDB",
      maxZoom: 19,
    }
  ).addTo(map);

  // Custom marker icon
  const customIcon = L.divIcon({
    className: "custom-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -34],
  });

  // Add smooth zoom
  map.options.zoomSnap = 0.1;
  map.options.zoomDelta = 0.5;
}

function initializeDestinationHandlers() {
  // Add destination button
  document
    .getElementById("add-destination")
    .addEventListener("click", addDestination);

  // Initialize the first destination
  const firstDestInput = document.querySelector(".destination-input");
  if (firstDestInput) {
    firstDestInput.id = "destination-0";
  }

  // Setup event delegation for remove buttons
  document
    .getElementById("destinations-container")
    .addEventListener("click", function (e) {
      if (e.target.closest(".remove-destination")) {
        const destItem = e.target.closest(".destination-item");
        if (
          destItem &&
          document.querySelectorAll(".destination-item").length > 1
        ) {
          destItem.remove();
          updateDestinationLabels();
        }
      }
    });
}

function addDestination() {
  const container = document.getElementById("destinations-container");
  const destCount = container.querySelectorAll(".destination-item").length;

  const newDest = document.createElement("div");
  newDest.className = "destination-item";
  newDest.innerHTML = `
        <div class="input-group">
            <input type="text" id="destination-${destCount}" class="destination-input" placeholder=" ">
            <label for="destination-${destCount}"><i class="fas fa-map-marker-alt"></i> Destination ${destCount}</label>
        </div>
        <button class="remove-destination"><i class="fas fa-times"></i></button>
    `;

  container.appendChild(newDest);

  // Show all remove buttons if we have more than one destination
  if (destCount > 0) {
    document.querySelectorAll(".remove-destination").forEach((btn) => {
      btn.style.display = "flex";
    });
  }

  // Focus the new input
  newDest.querySelector("input").focus();

  // Animate the new destination
  anime({
    targets: newDest,
    opacity: [0, 1],
    translateY: [20, 0],
    easing: "easeOutExpo",
    duration: 500,
  });
}

function updateDestinationLabels() {
  const items = document.querySelectorAll(".destination-item");
  items.forEach((item, index) => {
    const input = item.querySelector("input");
    const label = item.querySelector("label");

    input.id = `destination-${index}`;
    label.setAttribute("for", `destination-${index}`);

    if (index === 0) {
      label.innerHTML = '<i class="fas fa-map-marker-alt"></i> Starting Point';
    } else {
      label.innerHTML = `<i class="fas fa-map-marker-alt"></i> Destination ${index}`;
    }

    // Hide remove button on first item if only one destination
    if (index === 0 && items.length === 1) {
      item.querySelector(".remove-destination").style.display = "none";
    } else {
      item.querySelector(".remove-destination").style.display = "flex";
    }
  });
}

function initializeThemeToggle() {
  const themeToggleBtn = document.getElementById("themeToggle");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");
      updateThemeIcon(themeToggleBtn);
      
      // Remove the map tile layer update for dark mode
      // Keep the light theme map tiles regardless of dark mode
      if (map._layers[Object.keys(map._layers)[0]]._url !== 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png') {
        map.removeLayer(map._layers[Object.keys(map._layers)[0]]);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB',
            maxZoom: 19
        }).addTo(map);
      }
    });
    
    // Set initial icon state
    updateThemeIcon(themeToggleBtn);
  }
}

function updateThemeIcon(button) {
  const icon = button.querySelector("i");
  if (icon) {
    icon.className = document.body.classList.contains("dark-mode")
      ? "fas fa-sun"
      : "fas fa-moon";
  }
}

async function getCoordinates(place) {
  try {
    let response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        place
      )}`
    );
    let geoData = await response.json();

    if (geoData.length > 0) {
      return {
        lat: parseFloat(geoData[0].lat),
        lon: parseFloat(geoData[0].lon),
        name: geoData[0].display_name.split(",")[0],
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting coordinates:", error);
    return null;
  }
}

async function planMultiCityTrip() {
  // Show loading
  const loadingText = document.getElementById("loading");
  loadingText.style.display = "flex";

  // Remove any existing routing alternatives panel
  const routingAlt = document.querySelector('.leaflet-routing-alt');
  if (routingAlt) {
    routingAlt.remove();
  }

  // Clear previous data
  destinations = [];
  if (markers.length) {
    markers.forEach((marker) => map.removeLayer(marker));
  }
  markers = [];

  if (routeControl) {
    map.removeControl(routeControl);
  }

  // Get all destinations
  const inputs = document.querySelectorAll(".destination-input");
  const destinationPromises = [];

  inputs.forEach((input) => {
    if (input.value.trim()) {
      destinationPromises.push(getCoordinates(input.value));
    }
  });

  // Wait for all geocoding requests
  const results = await Promise.all(destinationPromises);
  const validDestinations = results.filter((result) => result !== null);

  if (validDestinations.length < 2) {
    loadingText.style.display = "none";
    alert("Please enter at least two valid destinations");
    return;
  }

  // Store valid destinations
  destinations = validDestinations;

  // Add markers for each destination
  destinations.forEach((dest, index) => {
    const customIcon = L.divIcon({
      className: "custom-marker",
      html: `<div class="marker-label">${index + 1}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -34],
    });

    const marker = L.marker([dest.lat, dest.lon], {
      icon: customIcon,
    }).addTo(map);

    marker.bindPopup(`<b>${index + 1}. ${dest.name}</b>`);
    markers.push(marker);
  });

  // Determine route type
  const routeType = document.querySelector(
    'input[name="routeType"]:checked'
  ).value;
  let routeWaypoints = [];

  if (routeType === "sequential") {
    // Use destinations in the order they were entered
    routeWaypoints = destinations.map((dest) => L.latLng(dest.lat, dest.lon));
  } else {
    // For optimal route, we'll use a simple nearest neighbor algorithm
    routeWaypoints = optimizeRoute(destinations).map((dest) =>
      L.latLng(dest.lat, dest.lon)
    );
  }

  // Create route
  routeControl = L.Routing.control({
    waypoints: routeWaypoints,
    routeWhileDragging: false,
    lineOptions: {
      styles: [
        { color: "white", opacity: 0.9, weight: 9 },
        { color: "#6c5ce7", opacity: 1, weight: 5 },
      ],
    },
    createMarker: function () {
      return null;
    },
    show: false,
    addWaypoints: false,
    showAlternatives: false, // Disable alternative routes
    containerClassName: 'display-none' // Hide the routing container
  }).addTo(map);
  
  // Add CSS to hide the routing container
  const style = document.createElement('style');
  style.textContent = '.display-none { display: none !important; }';
  document.head.appendChild(style);

  // Fit map to show all destinations
  const bounds = L.latLngBounds(routeWaypoints);
  map.fitBounds(bounds, { padding: [50, 50] });

  // Generate itinerary
  await generateMultiCityItinerary(destinations, routeType);

  // Hide loading
  loadingText.style.display = "none";
}

// Simple nearest neighbor algorithm for route optimization
function optimizeRoute(points) {
  if (points.length <= 2) return points;

  const optimized = [points[0]]; // Start with first point
  const remaining = points.slice(1);

  while (remaining.length > 0) {
    const current = optimized[optimized.length - 1];
    let nearestIndex = 0;
    let nearestDistance = calculateDistance(
      current.lat,
      current.lon,
      remaining[0].lat,
      remaining[0].lon
    );

    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(
        current.lat,
        current.lon,
        remaining[i].lat,
        remaining[i].lon
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    optimized.push(remaining[nearestIndex]);
    remaining.splice(nearestIndex, 1);
  }

  return optimized;
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

async function generateMultiCityItinerary(destinations, routeType) {
  const numDays = parseInt(document.getElementById("numDays").value) || 7;
  const itineraryDiv = document.getElementById("itinerary");

  itineraryDiv.innerHTML = ""; // Clear previous results

  // Calculate days per destination
  const totalDestinations = destinations.length;
  let daysPerDestination = [];

  if (totalDestinations === 0) return;

  // Simple allocation of days
  const baseDays = Math.floor(numDays / totalDestinations);
  let remainingDays = numDays % totalDestinations;

  for (let i = 0; i < totalDestinations; i++) {
    daysPerDestination[i] = baseDays;
    if (remainingDays > 0) {
      daysPerDestination[i]++;
      remainingDays--;
    }
  }

  // Generate itinerary for each destination
  let structuredHTML = `<h3><i class="fas fa-map-marked-alt"></i> Multi-City Travel Itinerary</h3>
                         <p class="itinerary-summary">Your ${numDays}-day journey through ${destinations
    .map((d) => d.name)
    .join(", ")}</p>`;

  let currentDay = 1;

  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    const daysHere = daysPerDestination[i];

    structuredHTML += `
            <div class="city-header">
                <h3><i class="fas fa-city"></i> ${i + 1}. ${
      dest.name
    } (${daysHere} days)</h3>
            </div>
        `;

    // Generate AI itinerary for this destination
    const destItinerary = await generateDestinationItinerary(
      dest.name,
      daysHere,
      currentDay
    );
    structuredHTML += destItinerary;

    currentDay += daysHere;
  }

  // Add travel tips
  structuredHTML += `
        <div class="travel-tips">
            <h3><i class="fas fa-lightbulb"></i> Travel Tips</h3>
            <ul>
                <li><i class="fas fa-suitcase"></i> Pack light and versatile clothing for multiple destinations</li>
                <li><i class="fas fa-train"></i> Consider rail passes if traveling between cities in Europe</li>
                <li><i class="fas fa-money-bill-wave"></i> Notify your bank of your travel plans to avoid card issues</li>
                <li><i class="fas fa-mobile-alt"></i> Download offline maps for each destination</li>
                <li><i class="fas fa-language"></i> Learn basic phrases in the local languages</li>
            </ul>
        </div>
    `;

  itineraryDiv.innerHTML = structuredHTML;
  animateItinerary();
}

async function generateDestinationItinerary(place, numDays, startDay) {
  try {
    let prompt = `Give me a detailed ${numDays}-day travel itinerary for ${place}, including morning, afternoon, and evening activities. Format with "Day X: Morning:", "Day X: Afternoon:", "Day X: Evening:" headers.`;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_length: 800 },
        }),
      }
    );

    const aiResponse = await response.json();

    if (!aiResponse || aiResponse.error)
      throw new Error("Failed to get AI response");

    let generatedText =
      aiResponse[0]?.generated_text || "No data received from AI.";

    return formatDestinationItinerary(generatedText, place, numDays, startDay);
  } catch (error) {
    console.error("Error generating itinerary:", error);
    return `<p class="error">⚠️ Could not generate itinerary for ${place}. Please try again.</p>`;
  }
}

function formatDestinationItinerary(rawText, place, numDays, startDay) {
  let structuredHTML = "";

  // Splitting into Days
  let days = rawText.split(/Day \d+:/);
  days.shift(); // Remove first empty element

  // Limit to the number of days we want
  days = days.slice(0, numDays);

  days.forEach((dayText, index) => {
    const actualDayNumber = startDay + index;
    let lines = dayText
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");
    let dayTitle = `Day ${actualDayNumber}`;

    structuredHTML += `
            <div class="itinerary-item">
                <h3><i class="fas fa-calendar-day"></i> ${dayTitle} in ${place}</h3>
        `;

    let timeSlots = { Morning: [], Afternoon: [], Evening: [] };
    let currentTime = "";

    lines.forEach((line) => {
      if (line.match(/^(Morning|Afternoon|Evening):/)) {
        currentTime = line.replace(":", "").trim();
      } else if (currentTime && Object.keys(timeSlots).includes(currentTime)) {
        timeSlots[currentTime].push(line.trim());
      }
    });

    Object.keys(timeSlots).forEach((time) => {
      if (timeSlots[time].length > 0) {
        let timeIcon =
          time === "Morning"
            ? "fa-sun"
            : time === "Afternoon"
            ? "fa-cloud-sun"
            : "fa-moon";

        structuredHTML += `
                    <h4><i class="fas ${timeIcon}"></i> ${time}</h4>
                    <ul>
                `;

        timeSlots[time].forEach((activity) => {
          structuredHTML += `
                        <li><i class="fas fa-check-circle"></i> ${activity}</li>
                    `;
        });

        structuredHTML += "</ul>";
      }
    });

    structuredHTML += "</div>";
  });

  return structuredHTML;
}

// Smooth Appearance Animation using Anime.js
function animateItinerary() {
  anime({
    targets: ".itinerary-item, .city-header, .travel-tips",
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(150),
    easing: "easeOutExpo",
  });
}
