# Find a Ride Update Verification

The RideMate preview opened successfully. Navigating to Find a Ride rendered editable controls labeled Find ride origin, Find ride destination, and Find ride departure time, plus an Update button. The view showed the current DBUU → Bhauwala route and a clean empty-state result. The Update button was visible and enabled before interaction.

After selecting Manduwala as the origin, the results heading and route summary updated to Manduwala → Bhauwala. The button briefly showed “Updating…” and then returned to an enabled “Update” state after the query settled, confirming the refresh path is active.

The destination was changed to DBUU and the departure time to 6:00 PM. The results summary updated to Manduwala → DBUU · Today · around 6:00 PM, and the query showed its brief Updating… state before returning the Update button to enabled.

With Manduwala → DBUU and 6:00 PM selected, clicking Update completed without an error. The route/time summary remained applied, the empty-state result remained consistent with the current database, and the button returned to its enabled “Update” label, confirming repeated refreshes are possible.

After the explicit-Update patch, reopening Find a Ride shows editable origin, destination, and departure-time controls with the current DBUU → Bhauwala · 4:30 PM criteria and an enabled Update button.

In the latest build, changing the draft origin to Naugaon and destination to DBUU changed only the control values. The committed heading and route summary remained DBUU → Bhauwala · 4:30 PM, while the Update button stayed enabled, showing that edits now wait for explicit application.

After the pending filter edits, clicking Update changed the committed summary to Naugaon → DBUU · Today · around 6:00 PM. The results state remained stable with 0 nearby matches for that route, demonstrating that the current draft values were applied only by the Update action.
