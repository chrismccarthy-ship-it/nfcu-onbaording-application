/**
 * CardDocumentAIService
 * Uses the Agentforce Models API (aiplatform.ModelsAPI) to extract structured
 * application field values from an uploaded document's text. Returns a JSON string
 * keyed by Application__c field API names, which the LWC merges into the form for
 * the user to review before submitting.
 *
 * PREREQUISITE: Einstein Generative AI must be enabled and the running user must
 * have the "Einstein Generative AI User" permission set. If your org does not have
 * this feature, remove this class and the cardDocumentUpload usage before deploying.
 */
public with sharing class CardDocumentAIService {

    private static final String MODEL = 'sfdc_ai__DefaultOpenAIGPT4OmniMini';

    // Field API names the model is allowed to populate (kept in sync with the object).
    private static final String FIELD_LIST =
        'First_Name__c, Middle_Name__c, Last_Name__c, Suffix__c, Address_Line_1__c, ' +
        'Address_Line_2__c, City__c, State__c, Zip_Code__c, Country_of_Residence__c, ' +
        'Different_Statement_Address__c, Primary_Contact_Number__c, Primary_Phone_Type__c, ' +
        'Email__c, SSN__c, Date_of_Birth__c, Mothers_Maiden_Name__c, US_Citizen__c, ' +
        'Country_of_Citizenship__c, Citizenship_Status__c, Dual_Citizenship__c, ' +
        'Country_of_Dual_Citizenship__c, Existing_Accounts__c, Employment_Status__c, ' +
        'Occupation__c, Employer__c, Years_in_Occupation__c, Work_Phone__c, ' +
        'Gross_Annual_Income__c, Source_of_Income__c, Monthly_Housing_Payment__c, ' +
        'Balance_Transfer_Requested__c, Number_of_Balances__c, Transfer_Institution__c, ' +
        'Transfer_Account_Number__c, Transfer_Requested_Amount__c, Add_Authorized_User__c, ' +
        'Card_Product_Name__c';

    @AuraEnabled
    public static String extractFields(String documentText) {
        if (String.isBlank(documentText)) {
            throw new AuraHandledException('No document text was provided to parse.');
        }

        String prompt =
            'You are a data-extraction assistant for a credit card application. ' +
            'Read the DOCUMENT below and extract any values that map to these Salesforce ' +
            'field API names:\n' + FIELD_LIST + '\n\n' +
            'Rules:\n' +
            '- Return ONLY a single JSON object. No prose, no code fences.\n' +
            '- Use the exact field API names above as keys.\n' +
            '- Omit any field you cannot confidently determine.\n' +
            '- Dates must be formatted YYYY-MM-DD.\n' +
            '- Currency/number fields must be plain numbers (no $ or commas): ' +
            'Gross_Annual_Income__c, Monthly_Housing_Payment__c, Transfer_Requested_Amount__c, Years_in_Occupation__c.\n' +
            '- Boolean fields must be true or false: US_Citizen__c, Dual_Citizenship__c, ' +
            'Different_Statement_Address__c, Balance_Transfer_Requested__c, Add_Authorized_User__c.\n' +
            '- Existing_Accounts__c is a semicolon-separated list from: Checking, Savings, None.\n' +
            '- Picklists must match these options exactly:\n' +
            '  Suffix__c: Jr., Sr., II, III, IV\n' +
            '  Primary_Phone_Type__c: Mobile phone, Home phone\n' +
            '  Citizenship_Status__c: U.S. Citizen, Permanent Resident, Non-Permanent Resident, Other\n' +
            '  Employment_Status__c: Employed, Homemaker, Permanently Disabled, Retired, Self-Employed, Student, Unemployed\n' +
            '  Occupation__c: Accountant, Architect, Programmer/Developer, Engineer, Teacher, Nurse, Physician, Manager, Sales, Consultant, Attorney, Other\n' +
            '  Source_of_Income__c: Employment Income, Inheritance/Trust, Investment Income, Retirement Income, Social Security, Unemployment/Other Income\n' +
            '  Number_of_Balances__c: 1, 2, 3\n' +
            '  Transfer_Institution__c: Chase, Citi, Capital One, Discover, American Express, Wells Fargo, U.S. Bank, Other\n' +
            '  State__c / Country fields: full names (e.g. Colorado, United States).\n\n' +
            'DOCUMENT:\n' + documentText;

        try {
            aiplatform.ModelsAPI.createGenerations_Request request =
                new aiplatform.ModelsAPI.createGenerations_Request();
            request.modelName = MODEL;

            aiplatform.ModelsAPI_GenerationRequest genRequest =
                new aiplatform.ModelsAPI_GenerationRequest();
            genRequest.prompt = prompt;
            request.body = genRequest;

            aiplatform.ModelsAPI.createGenerations_Response response =
                new aiplatform.ModelsAPI().createGenerations(request);

            if (response.Code200 != null &&
                response.Code200.generation != null) {
                return cleanJson(response.Code200.generation.generatedText);
            }
            throw new AuraHandledException('The AI model returned no response.');
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Document parsing failed: ' + e.getMessage());
        }
    }

    @TestVisible
    private static String cleanJson(String raw) {
        if (String.isBlank(raw)) {
            return '{}';
        }
        String t = raw.trim();
        if (t.startsWith('```')) {
            t = t.replaceFirst('(?s)^```[a-zA-Z]*\\s*', '');
            if (t.endsWith('```')) {
                t = t.substring(0, t.length() - 3);
            }
            t = t.trim();
        }
        Integer first = t.indexOf('{');
        Integer last = t.lastIndexOf('}');
        if (first >= 0 && last > first) {
            t = t.substring(first, last + 1);
        }
        return t;
    }
}