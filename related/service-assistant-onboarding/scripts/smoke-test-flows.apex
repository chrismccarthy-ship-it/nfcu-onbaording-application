// Runs each Underwriter Workflow agent-action flow and prints the first line of its output.
String caseId = '500Kh00000o4HE2IAM';
Map<String, Map<String, Object>> runs = new Map<String, Map<String, Object>>{
    'UW_Get_Workflow_Guidance' => new Map<String, Object>{ 'caseId' => caseId, 'workflowStage' => 'Final approval review' },
    'UW_Extract_Loan_Document_Data' => new Map<String, Object>{ 'caseId' => caseId },
    'UW_Draft_Customer_Email' => new Map<String, Object>{ 'caseId' => caseId, 'emailPurpose' => 'correction', 'stipulations' => 'insurance binder naming lienholder' },
    'UW_Initiate_Slack_Swarm' => new Map<String, Object>{ 'caseId' => caseId, 'swarmReason' => 'mismatch' }
};
Map<String, String> outputs = new Map<String, String>{
    'UW_Get_Workflow_Guidance' => 'guidance',
    'UW_Extract_Loan_Document_Data' => 'extractionSummary',
    'UW_Draft_Customer_Email' => 'emailDraft',
    'UW_Initiate_Slack_Swarm' => 'swarmResult'
};
for (String flowName : runs.keySet()) {
    Flow.Interview f = Flow.Interview.createInterview(flowName, runs.get(flowName));
    f.start();
    String out = (String) f.getVariableValue(outputs.get(flowName));
    System.debug('UWTEST ' + flowName + ' len=' + (out == null ? 0 : out.length()) + ' :: ' + (out == null ? 'NULL' : out.split('\n')[0] + ' | ' + out.split('\n')[1]));
}
