// Add a listener to receive messages from the content script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "displayResponse") {
    var responseContainer = document.getElementById("response-container");
    responseContainer.innerText = JSON.stringify(message.response);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  var runBotButton = document.getElementById("runBot");
  runBotButton.addEventListener("click", function () {
    var eventDetailsTextarea = document.getElementById("event-details");
    var eventDetails = eventDetailsTextarea.value.trim();

    // Check if event details textarea is empty
    if (eventDetails === "") {
      eventDetailsTextarea.style.borderColor = "red";
      return;
    }

    eventDetailsTextarea.style.borderColor = ""; // Reset border color

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapeInputsAndRespond,
        args: [eventDetails], // Pass event details as an argument
      });
    });
  });
});

function scrapeInputsAndRespond(eventDetails) {
  // This function will be executed in the context of the active tab
  console.log("scrapeInputsAndRespond");

  // Scrape inputs and their labels
  var inputs = document.getElementsByTagName("input");
  var textareas = document.getElementsByTagName("textarea");
  var elements = Array.from(inputs).concat(Array.from(textareas));
  var results = [];
  var order = [];

  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];

    var label = "";
    var labels = document.getElementsByTagName("label");
    for (var j = 0; j < labels.length; j++) {
      if (labels[j].htmlFor === element.id) {
        label = labels[j].innerText;
        break;
      }
    }
    if (label === "") continue;
    results.push(label);
    order.push({ label: label, value: element.value });
  }

  //   call http
  const url = "http://127.0.0.1:5001/chat";
  const requestData = {
    user_id: "user_1",
    query: {
      event_details: eventDetails,
      template_input_questions: results,
    },
    premium: true,
  };

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);

        // Parse the response string into an object
        const responseObject = JSON.parse(response);
        console.log(responseObject);
        // Update the input values from the response object
        for (var i = 0; i < results.length; i++) {
          var result = results[i];
          // Check if the label exists in the response object
          if (responseObject.hasOwnProperty(result)) {
            var valueFromResponse = responseObject[result];
            // Find the corresponding input element by label text
            var inputElement = elements.find(function (element) {
              var labelElement = document.querySelector(
                'label[for="' + element.id + '"]'
              );
              return labelElement && labelElement.innerText === result;
            });
            if (inputElement) {
              if (Array.isArray(valueFromResponse)) {
                valueFromResponse = valueFromResponse.join("\n");
              } else {
                inputElement.value = valueFromResponse;
              }
            }
          }
        }
      } else {
        console.error("HTTP request failed with status:", xhr.status);
      }
    }
  };

  xhr.send(JSON.stringify(requestData));
}
