import UIKit

class DashboardNavigationController: UINavigationController {

    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Enable large titles
        navigationBar.prefersLargeTitles = true
        
        // Customize the appearance
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.largeTitleTextAttributes = [.foregroundColor: UIColor.white]
        appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        appearance.backgroundColor = UIColor.black
        
        navigationBar.standardAppearance = appearance
        navigationBar.scrollEdgeAppearance = appearance
    }
}
