import UIKit
import React

@objc(DashboardNavigationManager)
class DashboardNavigationManager: NSObject {
  
    @objc
    func showNavigation() {
        // Logic to present the DashboardNavigationController
        let navigationController = DashboardNavigationController()
        if let rootViewController = UIApplication.shared.keyWindow?.rootViewController {
            rootViewController.present(navigationController, animated: true, completion: nil)
        }
    }
}

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
