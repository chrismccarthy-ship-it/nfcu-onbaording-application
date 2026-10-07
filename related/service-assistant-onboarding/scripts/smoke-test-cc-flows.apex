// Runs the Credit Card Account Opening agent-action flows with a Case Id and with a Messaging Session Id.
List<String> recordIds = new List<String>{ '500Kh00000o4I0LIAU', '0MwKh000001VbVMKA0' };
Map<String, String> outputs = new Map<String, String>{
    'CC_Check_Membership_Eligibility' => 'eligibilityResult',
    'CC_Find_Card_Applications' => 'applicationsResult',
    'CC_Review_Application_Requirements' => 'requirementsResult',
    'CC_Identity_Fraud_Screening' => 'screeningResult',
    'CC_Draft_Requirements_Email' => 'emailDraft'
};
for (String recordId : recordIds) {
    for (String flowName : outputs.keySet()) {
        Map<String, Object> inputs = new Map<String, Object>{ 'recordId' => recordId };
        if (flowName == 'CC_Draft_Requirements_Email') {
            inputs.put('requestedItems', '1. Government-issued ID\n2. Authorized user details');
        }
        Flow.Interview f = Flow.Interview.createInterview(flowName, inputs);
        f.start();
        String out = (String) f.getVariableValue(outputs.get(flowName));
        System.debug('CCTEST ' + recordId.left(3) + ' ' + flowName + ' >>> ' + (out == null ? 'NULL' : out.replace('\n', ' // ').left(230)));
    }
}
