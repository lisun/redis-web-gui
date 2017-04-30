/**
 * WebSocketServer.py
 *
 * Author: Toki Migimatsu
 * Created: April 2017
 */

$(document).ready(function() {
	// Set up web socket
	var urlParser = document.createElement("a");
	urlParser.href = window.location.href;
	var ws_ip = urlParser.hostname;
	var ws_port = %(ws_port)s;
	var ws = new WebSocket("ws://" + ws_ip + ":" + ws_port);

	ws.onopen = function() {
		console.log("Web socket connection established.");
	};

	ws.onmessage = function(e) {
		// console.log(e.data);
		var msg = JSON.parse(e.data);
		msg.forEach(function(m) {
			var key = m[0];
			var val = m[1];
			var $form = $("form[data-key='" + key + "']");

			// Create new redis key-value form
			if ($form.length == 0) {
				var form = "<a name='" + key + "'></a><form data-key='" + key + "'><div class='keyval-card'>\n";
				form += "\t<div class='key-header'>\n";
				form += "\t\t<label>" + key + "</label>\n";
				form += "\t\t<input type='submit' value='Set' title='Set values in Redis: <enter>'>\n";
				form += "\t\t<input type='button' value='Rep' class='repeat' title='Repeat value of first element: <shift-enter>'>\n";
				form += "\t\t<input type='button' value='Tog' class='toggle' title='Toggle values between current state and 0: <alt-enter>'>\n";
				form += "\t\t<input type='button' value='Cpy' class='copy' title='Copy value to clipboard'>\n";
				form += "\t</div>\n";
				form += "\t<div class='val-body'>\n";
				if (typeof(val) === "string") {
					form += "\t\t<input class='val val-string' type='text' value='" + val + "'>\n";
				} else {
					val.forEach(function(el, idx) {
						if (idx %% 3 == 0) {
							form += "\t\t<div class='val-triplet'>\n";
						}
						form += "\t\t\t<input class='val' type='text' value='" + el + "'>\n";
						if (idx %% 3 == 2) {
							form += "\t\t</div>\n";
						}

					});
				}
				form += "\t</div>\n";
				form += "</div></form>\n";
				var $form = $(form).hide();
				var li = "<a href='#" + key + "' title='" + key + "'><li>" + key + "</li></a>";
				var $li = $(li).hide();

				// Find alphabetical ordering
				var keys = $("form").map(function() {
					return $(this).attr("data-key");
				}).get();
				var idx_key;
				for (idx_key = 0; idx_key < keys.length; idx_key++) {
					if (key < keys[idx_key]) break;
				}
				if (idx_key < keys.length) {
					$("form").eq(idx_key).before($form);
					$("#left-col a").eq(idx_key).before($li);
				} else {
					$("#right-col").append($form);
					$("#left-col ul").append($li)
				}
				$form.slideDown("normal");
				$li.slideDown("normal");
				return;
			}

			// Update redis val as simple string
			var $inputs = $form.find("input.val");
			if (typeof(val) === "string" && val != "NaN") {
				for (var i = 1; i < $inputs.length; i++) {
					$inputs.eq(i).remove();
				}
				$inputs.eq(0).val(val);
				$inputs.addClass("val-string");
				return;
			}

			// Update redis val as array
			val.forEach(function(el, idx) {
				var $input = $inputs.eq(idx);
				$input.removeClass("val-string");

				// Extend array if necessary
				if ($input.length == 0) {
					if (idx %% 3 == 0) {
						var div = "<div class='val-triplet'>\n";
						div += "\t\t<input class='val' type='text' value='" + el + "'>\n";
						div += "</div>";
						$form.find("input.val").eq(idx - 1).parent().after(div);
						return;
					}
					var input = "\t\t<input class='val' type='text' value='" + el + "'>\n";
					$form.find("input.val").eq(idx - 1).after(input);
					return;
				}

				$input.val(el);
			});

			// Shorten array if necessary
			for (var i = val.length; i < $inputs.length; i++) {
				if (i %% 3 == 0) {
					$inputs.eq(i).parent().remove();
					continue;
				}
				$inputs.eq(i).remove();
			}
		});
	};

	// Send updated key-val pair via POST
	var ajaxSendRedis = function(key, val) {
		data = {};
		data[key] = JSON.stringify(val);
		console.log(data);
		$.ajax({
			method: "POST",
			url: "/",
			data: data
		});
	};

	// Change redis values on form submit
	$(document).on("submit", "form", function(e) {
		e.preventDefault();

		var key = $(this).attr("data-key");

		// Collect input values into array
		var val = $(this).find("input.val").map(function() {
			var el = $(this).val();
			var num = parseFloat(el);
			if (isNaN(num) || el.search(" ") != -1)
				return el;
			return num.toString();
		}).get();

		ajaxSendRedis(key, val);
	});


	// Repeat value of first element
	$(document).on("click", "input.repeat", function(e) {
		e.preventDefault();

		var $form = $(this).closest("form");

		// Get key
		var key = $form.attr("data-key");

		// Get first value in array
		var $inputs = $form.find("input.val");
		var el = $inputs.eq(0).val();
		var num = parseFloat(el);
		if (isNaN(num) || el.search(" ") != -1) {
			console.log("Can't repeat a non-number");
			return;
		}

		// Create full array from num
		var val = [];
		for (var i = 0; i < $inputs.length; i++) {
			val.push(num.toString());
		}

		ajaxSendRedis(key, val);
	});

	var collectInputValues = function($inputs) {
		val = $inputs.map(function() {
			var el = $(this).val();
			var num = parseFloat(el);
			if (isNaN(num) || el.search(" ") != -1)
				return el;
			return num.toString();
		}).get();
		return val;
	};

	// Toggle values between current state and 0
	$(document).on("click", "input.toggle", function(e) {
		e.preventDefault();

		var $form = $(this).closest("form");

		// Get key
		var key = $form.attr("data-key");

		// Get val
		var val;
		if (!$form.attr("data-val")) {
			// Collect input values into array
			var $inputs = $form.find("input.val");
			val = collectInputValues($inputs);

			// If val is 0, set to 1
			var el;
			if (val == "0") {
				el = "1";
			} else {
				el = "0";
				$form.attr("data-val", JSON.stringify(val));
			}

			// Create full array from num
			val = [];
			for (var i = 0; i < $inputs.length; i++) {
				val.push(el);
			}
		} else {
			// Get stored val and restore it
			val = JSON.parse($form.attr("data-val"));
			$form.attr("data-val", "");
		}

		ajaxSendRedis(key, val);
	});

	// Copy values to clipboard
	$(document).on("click", "input.copy", function(e) {
		e.preventDefault();

		var $form = $(this).closest("form");
		var $inputs = $form.find("input.val");
		var val = collectInputValues($inputs);

		var $temp = $("<input>");
		$("body").append($temp);
		$temp.val(val.join(" ")).select();
		document.execCommand("copy");
		$temp.remove();
	});

	// Form submission shortcuts
	$(document).on("keydown", "form", function(e) {
		// Click repeat button on <shift-enter>
		if (e.shiftKey && e.keyCode == 13) {
			e.preventDefault();
			$(this).find("input.repeat").click();
			return;
		}

		// Click toggle button on <alt-enter>
		if (e.altKey && e.keyCode == 13) {
			e.preventDefault();
			$(this).find("input.toggle").click();
			return;
		}
	});

	// Easy <tab> key jumping
	var processingAnimation = false;
	$(document).on("keydown", "input.val", function(e) {
		if (processingAnimation) {
			e.preventDefault();
			return;
		}

		// Select first input of next form if currently in last input of current form
		if (!e.shiftKey && e.keyCode == 9 && $(this).is(":last-child") && $(this).parent().is(":last-child")) {
			e.preventDefault();
			var $nextForm = $(this).closest("form").nextAll("form:first");
			if ($nextForm.length == 0) return;

			// Scroll to next form if out of view
			var nextFormBottomRel = $nextForm.offset().top + $nextForm.height() + parseInt($nextForm.css("margin-bottom"));
			var nextFormBottomAbs = nextFormBottomRel + $("#right-col").scrollTop();
			if (nextFormBottomRel > window.innerHeight) {
				processingAnimation = true;
				$("#right-col").animate({scrollTop: nextFormBottomAbs - window.innerHeight}, 200, function() {
					$nextForm.find("input.val:first").focus();
					processingAnimation = false;
				});
				return;
			}
			$nextForm.find("input.val:first").focus();
		}

		// Select last input of previous form if currently in first input of current form
		if (e.shiftKey && e.keyCode == 9 && $(this).is(":first-child") && $(this).parent().is(":first-child")) {
			e.preventDefault();
			var $prevForm = $(this).closest("form").prevAll("form:first");
			if ($prevForm.length == 0) return;

			// Scroll to previous form if out of view
			var prevFormTopRel = $prevForm.position().top;
			var prevFormTopAbs = prevFormTopRel + $("#right-col").scrollTop();
			if (prevFormTopRel < 0) {
				processingAnimation = true;
				$("#right-col").animate({scrollTop: prevFormTopAbs}, 200, function() {
					$prevForm.find("input.val:last").focus();
					processingAnimation = false;
				});
				return;
			}
			$prevForm.find("input.val:last").focus();
		}
	});

	// Focus on card selected in key list
	$(document).on("click", "a", function(e) {
		var key = this.hash.substr(1);
		var $form = $("form[data-key='" + key + "']");
		if ($form.length == 0) return;

		e.preventDefault();

		// Calculate relevant dimensions
		var $input = $form.find("input.val").eq(0);
		var windowMiddle = Math.floor(window.innerHeight / 2);
		var totalHeight = $("#right-col").get(0).scrollHeight;
		var formMiddleRel = $form.offset().top + Math.floor($form.height() / 2);
		var formMiddleAbs = formMiddleRel + $("#right-col").scrollTop();
		var isTop = formMiddleAbs < windowMiddle;
		var isBottom = totalHeight - formMiddleAbs < windowMiddle;

		var scrollTo = -1;
		if (isTop && formMiddleRel < formMiddleAbs) {
			// For top region, scroll to top if not scrolled up as far as possible
			scrollTo = 0;
		} else if (isBottom && window.innerHeight - formMiddleRel < totalHeight - formMiddleAbs) {
			// For bottom region, scroll to bottom if not scrolled down as far as possible
			scrollTo = totalHeight - window.innerHeight;
		} else if (!isTop && !isBottom && formMiddleRel != windowMiddle) {
			// For middle region, scroll desired card to middle of window
			scrollTo = formMiddleAbs - windowMiddle;
		}
		if (scrollTo >= 0) {
			$('#right-col').animate({scrollTop: scrollTo}, 200, function() {
				$input.focus();
			});
			return;
		}
		$input.focus();
	});
});

