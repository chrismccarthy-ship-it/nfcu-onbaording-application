@IsTest
private class NFCU_MemberContactResolverTest {

    @TestSetup
    static void setupData() {
        insert new Contact(FirstName = 'Lauren', LastName = 'Bailey', Email = 'lauren.bailey.test@example.com');
    }

    @IsTest
    static void resolvesContactIdAndEmail() {
        Contact c = [SELECT Id FROM Contact WHERE LastName = 'Bailey' LIMIT 1];
        System.assertEquals(c.Id, NFCU_MemberContactResolver.resolve(c.Id));
        System.assertEquals(c.Id, NFCU_MemberContactResolver.resolve(' lauren.bailey.test@example.com '));
    }

    @IsTest
    static void returnsNullForUnusableInput() {
        Account a = new Account(Name = 'Not a contact');
        insert a;
        System.assertEquals(null, NFCU_MemberContactResolver.resolve(null));
        System.assertEquals(null, NFCU_MemberContactResolver.resolve('not-an-id'));
        System.assertEquals(null, NFCU_MemberContactResolver.resolve('nobody@example.com'));
        System.assertEquals(null, NFCU_MemberContactResolver.resolve(a.Id));
        System.assertEquals(null, NFCU_MemberContactResolver.resolve('0PA000000000000AAA'));
        System.assertEquals(null, NFCU_MemberContactResolver.resolve('0Mw000000000000AAA'));
    }
}
