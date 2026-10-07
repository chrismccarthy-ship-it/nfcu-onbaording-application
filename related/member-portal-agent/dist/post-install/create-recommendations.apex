// Run once after deploying the package: creates or updates the two Navy Federal Next Best Action recommendations.
// sf apex run -f post-install/create-recommendations.apex -o <target-org>
List<ContentAsset> logo = [SELECT Id FROM ContentAsset WHERE DeveloperName = 'NFCU_Logo' LIMIT 1];
Id logoId = logo.isEmpty() ? null : logo[0].Id;

Map<String, Recommendation> byName = new Map<String, Recommendation>();
for (Recommendation r : [SELECT Id, Name FROM Recommendation
                         WHERE Name IN ('Schedule Account Opening Appointment', 'Escalate to Security Team')]) {
    byName.put(r.Name, r);
}

Recommendation schedule = byName.containsKey('Schedule Account Opening Appointment')
    ? byName.get('Schedule Account Opening Appointment') : new Recommendation();
schedule.Name = 'Schedule Account Opening Appointment';
schedule.Description = 'Lauren is getting married before her PCS move. Her fiancé can join Navy Federal as her spouse. Book a video account-opening appointment.';
schedule.ActionReference = 'Schedule_Appointment_NBA';
schedule.AcceptanceLabel = 'Schedule now';
schedule.RejectionLabel = 'Not now';
schedule.ImageId = logoId;

Recommendation security = byName.containsKey('Escalate to Security Team')
    ? byName.get('Escalate to Security Team') : new Recommendation();
security.Name = 'Escalate to Security Team';
security.Description = 'Lauren\'s overseas address change was flagged by identity and fraud verification. Send her Flagship Premier application to the Security Team for a fraud check.';
security.ActionReference = 'Escalate_to_Security_Team_NBA';
security.AcceptanceLabel = 'Escalate';
security.RejectionLabel = 'Not now';
security.ImageId = logoId;

upsert new List<Recommendation>{ schedule, security };
System.debug('Recommendations ready: ' + schedule.Id + ', ' + security.Id);
