// Calls each agent-action flow with the legacy caseId input and with recordId (Case and Messaging Session).
Map<String, String> outputs = new Map<String, String>{
    'CC_Check_Membership_Eligibility' => 'eligibilityResult',
    'CC_Find_Card_Applications' => 'applicationsResult',
    'CC_Review_Application_Requirements' => 'requirementsResult',
    'CC_Identity_Fraud_Screening' => 'screeningResult',
    'CC_Draft_Requirements_Email' => 'emailDraft',
    'UW_Get_Workflow_Guidance' => 'guidance',
    'UW_Extract_Loan_Document_Data' => 'extractionSummary',
    'UW_Draft_Customer_Email' => 'emailDraft',
    'UW_Initiate_Slack_Swarm' => 'swarmResult'
};
List<Map<String, Object>> variants = new List<Map<String, Object>>{
    new Map<String, Object>{ 'caseId' => '500Kh00000o4I0LIAU' },
    new Map<String, Object>{ 'recordId' => '500Kh00000o4I0LIAU' },
    new Map<String, Object>{ 'recordId' => '0MwKh000001VbVMKA0' }
};
for (Map<String, Object> v : variants) {
    for (String flowName : outputs.keySet()) {
        Map<String, Object> inputs = v.clone();
        if (flowName == 'CC_Draft_Requirements_Email') inputs.put('requestedItems', '1. Government-issued ID');
        if (flowName == 'UW_Draft_Customer_Email') inputs.put('emailPurpose', 'correction');
        if (flowName == 'UW_Initiate_Slack_Swarm') inputs.put('swarmReason', 'mismatch');
        String result;
        try {
            Flow.Interview f = Flow.Interview.createInterview(flowName, inputs);
            f.start();
            String out = (String) f.getVariableValue(outputs.get(flowName));
            result = out == null ? 'NULL' : 'OK ' + out.replace('\n', ' ').left(70);
        } catch (Exception e) {
            result = 'ERROR ' + e.getMessage().left(120);
        }
        System.debug('BOTH ' + v.keySet() + ' ' + flowName + ' => ' + result);
    }
}
