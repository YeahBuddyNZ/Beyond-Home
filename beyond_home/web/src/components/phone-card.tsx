import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { box, forget } from "@/phone"

// The phone app's own setting: which box it's paired with, and a way to let go of it.
export function PhoneCard() {
  const at = box()?.base.replace(/^http:\/\//, "").replace(/:8098$/, "")
  return (
    <Card>
      <CardHeader>
        <CardTitle>This phone</CardTitle>
        <CardDescription>
          Paired with your Beyond Home box{at ? " at " + at : ""}. It works on your home Wi-Fi. TVs, music and the
          advanced screens are set up on the box itself, under Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={() => {
            forget(true)
            location.reload()
          }}
        >
          Forget this box
        </Button>
      </CardContent>
    </Card>
  )
}
