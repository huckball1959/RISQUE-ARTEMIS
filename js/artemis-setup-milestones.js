/**
 * ARTEMIS sequential setup — console milestones for 3-laptop debugging.
 * Watch for M1 → M2 → M3 in order on host; clients should mirror each step.
 */
(function () {
  "use strict";

  if (!window.risqueArtemisMode) return;

  var seq = 0;

  window.risqueArtemisSetupMilestone = function (id, detail) {
    seq += 1;
    var slot = window.risqueArtemisHost ? "HOST" : "P" + (Number(window.risqueArtemisPlayerSlot) || "?");
    try {
      if (detail !== undefined && detail !== null && detail !== "") {
        console.info("[ARTEMIS setup #" + seq + " " + slot + "] " + id, detail);
      } else {
        console.info("[ARTEMIS setup #" + seq + " " + slot + "] " + id);
      }
    } catch (eLog) {
      /* ignore */
    }
  };
})();
